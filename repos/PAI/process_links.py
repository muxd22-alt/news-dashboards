import os
import sys
import json
import datetime
import requests
import re
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

def make_rss(data_dict):
    rss = Element('rss', version='2.0')
    channel = SubElement(rss, 'channel')
    SubElement(channel, 'title').text = 'Private AI Newsroom'
    SubElement(channel, 'link').text = 'https://my-newsroom.vercel.app'
    SubElement(channel, 'description').text = 'Personal Intelligence Extracts & Tech Digest'

    if data_dict.get('masterDigest') and "Awaiting initial" not in data_dict.get('masterDigest'):
        item = SubElement(channel, 'item')
        SubElement(item, 'title').text = f"Daily Executive Summary & Knowledge Gap"
        SubElement(item, 'link').text = 'https://my-newsroom.vercel.app'
        SubElement(item, 'description').text = data_dict['masterDigest']
        SubElement(item, 'pubDate').text = data_dict.get('lastGenerated', '')

    for link in data_dict.get('links', []):
        item = SubElement(channel, 'item')
        SubElement(item, 'title').text = link.get('title', 'Unknown Title')
        SubElement(item, 'link').text = link.get('url', '')
        SubElement(item, 'description').text = link.get('summary', '')
        SubElement(item, 'pubDate').text = link.get('date', '')
        
        for kw in link.get('keywords', []):
            SubElement(item, 'category').text = kw

    xmlstr = minidom.parseString(tostring(rss)).toprettyxml(indent="  ")
    with open('rss.xml', 'w', encoding='utf-8') as f:
        f.write(xmlstr)

def get_openrouter_gaps(keywords, link_title, summary_text=""):
    api_key = os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        return None
    
    if not keywords:
        return None

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = f"""Article Title: "{link_title}"
Topics: {', '.join(keywords)}

Article Summary:
{summary_text}

Based on the above article summary and topics, identify 3 specific knowledge gaps or follow-up research areas the reader should investigate to deepen their understanding.

Format your response EXACTLY as:
1. [Topic/concept to research] — [One sentence explaining why this matters and what to look for]
2. [Topic/concept to research] — [One sentence explaining why this matters and what to look for]
3. [Topic/concept to research] — [One sentence explaining why this matters and what to look for]"""
    
    payload = {
        "model": "minimax/minimax-m2.5:free",
        "messages": [
            {"role": "system", "content": "You are a senior tech analyst. Your job is to identify knowledge gaps and suggest follow-up research topics based on the content provided. CRITICAL RULES: 1) NEVER say you don't have access to the article — you have the full summary above. 2) NEVER ask the user to share more info. 3) NEVER give generic advice — be specific to the content. 4) Always provide exactly 3 concrete, actionable research gaps."},
            {"role": "user", "content": prompt}
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        return content
    except Exception as e:
        print(f"Error calling OpenRouter: {e}")
        return None

def save_gap_to_file(link_title, url, keywords, gap_content):
    gaps_file = 'gaps.json'
    if os.path.exists(gaps_file):
        with open(gaps_file, 'r', encoding='utf-8') as f:
            try:
                gaps_data = json.load(f)
            except json.JSONDecodeError:
                gaps_data = {"gaps": []}
    else:
        gaps_data = {"gaps": []}
    
    gap_entry = {
        "title": link_title,
        "url": url,
        "keywords": keywords,
        "gap": gap_content,
        "date": datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    }
    
    gaps_data['gaps'].insert(0, gap_entry)
    gaps_data['gaps'] = gaps_data['gaps'][:100]
    gaps_data['lastUpdated'] = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    
    with open(gaps_file, 'w', encoding='utf-8') as f:
        json.dump(gaps_data, f, indent=2, ensure_ascii=False)
    
    return True

def get_openrouter_summary(text, prompt):
    api_key = os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        return "OPENROUTER_API_KEY not found. Mock Summary."

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "minimax/minimax-m2.5:free",
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Content to summarize:\n{text}"}
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        return result['choices'][0]['message']['content']
    except Exception as e:
        print(f"Error calling OpenRouter API: {e}")
        try:
            error_details = response.json()
        except:
            error_details = response.text if 'response' in locals() else "No response"
        return f"Failed to generate summary. Make sure OPENROUTER_API_KEY is correctly set in Github Secrets and the text doesn't violate safety policies. API Error: {error_details}"

def fetch_url_content(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text[:10000]
    except Exception as e:
        print(f"Failed to fetch content from {url}: {e}")
        return f"Could not fetch full content from {url}. Extract metadata based on URL context."

def fetch_rich_media_content(url):
    try:
        video_id = ""
        if "v=" in url:
            video_id = url.split("v=")[1].split("&")[0]
        elif "youtu.be/" in url:
            video_id = url.split("youtu.be/")[1].split("?")[0]
            
        if video_id:
            # === ATTEMPT 1: Baoyu YouTube Transcript Skill (InnerTube API) ===
            import subprocess
            import re
            try:
                # Skill is centralized in .gemini/skills/
                skill_path = os.path.join(".gemini", "skills", "baoyu-youtube-transcript", "scripts", "main.ts")
                cmd = ["bun", skill_path, url, "--no-timestamps"]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                combined_out = (result.stdout + "\n" + result.stderr).strip()
                
                md_path_match = re.search(r'([A-Za-z0-9_/\.\-\\]+\.md)', combined_out)
                if md_path_match:
                    try:
                        md_path = md_path_match.group(1).strip()
                        with open(md_path, 'r', encoding='utf-8') as f:
                            text = f.read()
                        if len(text.strip()) > 100:
                            print("SUCCESS: Got transcript via Baoyu skill")
                            return f"YOUTUBE VIDEO TRANSCRIPT:\n\n{text[:15000]}"
                    except FileNotFoundError:
                        pass
                print("Baoyu skill did not return usable transcript, trying youtube-transcript-api...")
            except Exception as e:
                print(f"Baoyu skill failed: {e}")

            # === ATTEMPT 2: yt-dlp VTT Extraction (Skill Equivalent) ===
            try:
                import subprocess, glob
                output_name = "transcript_temp"
                # Clean up any leftover vtt files
                for f in glob.glob(f"{output_name}*.vtt"):
                    try: os.remove(f)
                    except: pass
                
                print("Attempting to download manual subtitles via yt-dlp...")
                subprocess.run(["yt-dlp", "--write-sub", "--skip-download", "--output", output_name, url], capture_output=True)
                vtt_files = glob.glob(f"{output_name}*.vtt")
                
                if not vtt_files:
                    print("Manual subtitles not available. Trying auto-generated...")
                    subprocess.run(["yt-dlp", "--write-auto-sub", "--skip-download", "--output", output_name, url], capture_output=True)
                    vtt_files = glob.glob(f"{output_name}*.vtt")
                
                if vtt_files:
                    vtt_file = vtt_files[0]
                    seen = set()
                    lines = []
                    with open(vtt_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith('WEBVTT') and not line.startswith('Kind:') and not line.startswith('Language:') and '-->' not in line:
                                clean = re.sub(r'<[^>]*>', '', line)
                                clean = clean.replace('&amp;', '&').replace('&gt;', '>').replace('&lt;', '<')
                                if clean and clean not in seen:
                                    lines.append(clean)
                                    seen.add(clean)
                    try: os.remove(vtt_file)
                    except: pass
                    text = " ".join(lines)
                    if len(text.strip()) > 100:
                        print("SUCCESS: Got transcript via yt-dlp VTT extraction")
                        return "YOUTUBE VIDEO TRANSCRIPT:\n\n" + text[:15000]
                else:
                    print("No VTT subtitles found by yt-dlp.")
            except Exception as e:
                print(f"yt-dlp transcript extraction failed: {e}")

        # === ATTEMPT 3: yt-dlp metadata (title + description) ===
        try:
            ydl_opts = {'quiet': True, 'skip_download': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                desc = info.get('description', '')
                title = info.get('title', '')
                uploader = info.get('uploader', '')
                duration = info.get('duration_string', '')
                content = f"MEDIA METADATA:\nTitle: {title}\nAuthor/Channel: {uploader}\nDuration: {duration}\nDescription:\n{desc}"
                print("SUCCESS: Got metadata via yt-dlp")
                return content[:15000]
        except Exception as e:
            print(f"yt-dlp metadata failed: {e}")

        # === ATTEMPT 4: Noembed (title-only, last resort) ===
        if video_id:
            try:
                noembed_res = requests.get(f"https://noembed.com/embed?url={url}", timeout=10).json()
                if 'title' in noembed_res:
                    title = noembed_res['title']
                    author = noembed_res.get('author_name', 'Unknown')
                    print(f"FALLBACK: Got title-only via Noembed: {title}")
                    return f"TITLE & CONTEXT INFERENCE:\nVideo Title: {title}\nChannel: {author}\n\nINSTRUCTION: The raw transcript was not extractable. HOWEVER, you must act as a 'second brain' for the user. Use the title and channel to infer the core themes, and generate a rich, highly substantive analysis of the topics likely discussed. Synthesize known facts, historical context, key debates, and potential implications related to this topic. Make it dense with keywords and actionable insights so the user can use this as a powerful node in their knowledge base."
            except Exception:
                pass

        return f"ERROR: All extraction methods failed for URL: {url}. No content available."
    except Exception as e:
        print(f"Content fetch crashed: {e}")
        return f"ERROR: Extraction crashed for URL: {url}."

def main():
    if len(sys.argv) < 2:
        print("Usage: python process_links.py '<ISSUE_TITLE>'")
        sys.exit(1)

    issue_title = sys.argv[1].strip()
    
    urls = re.findall(r'(https?://[^\s]+)', issue_title)
    if not urls:
        target_url = issue_title
        scraped_text = "No URL provided or invalid URL."
    else:
        target_url = urls[0]
        print(f"Processing URL: {target_url}")
        media_domains = ['youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 'x.com', 'instagram.com']
        if any(d in target_url.lower() for d in media_domains):
            scraped_text = fetch_rich_media_content(target_url)
        else:
            scraped_text = fetch_url_content(target_url)

    system_prompt = """You are an expert analyst acting as the user's "second brain" and personal knowledge base curator. Your goal is to synthesize the provided content into a dense, highly useful knowledge node for future research, idea connection, and tracking.

CRITICAL RULES:
- NEVER complain about missing transcripts or lack of access. Just dive straight into delivering value.
- If given limited content (like just a title), perform a "knowledge expansion"—synthesize the broader implications, known context, and key debates logically surrounding the topic.
- Extract profound insights, not just surface-level descriptions. Explain "Why does this matter?" and "What structural shifts does this reveal?"
- Make the summary highly searchable, packing it with relevant concepts, underlying technologies, and strategic frameworks.
- NEVER ask the user to share more details.

Provide up to 3 highly substantive paragraphs explaining the core concepts, broader context, and actionable takeaways.
After the summary, extract 3 to 5 highly specific core keywords or topics.

Format your response EXACTLY like this:
SUMMARY_START
[Your up to 3 paragraph synthesis here]
SUMMARY_END
KEYWORDS: keyword1, keyword2, keyword3
"""
    
    raw_response = get_openrouter_summary(scraped_text, system_prompt)
    
    summary = raw_response
    keywords = []
    
    # Parse the structured response
    try:
        if "SUMMARY_START" in raw_response and "SUMMARY_END" in raw_response:
            s_start = raw_response.find("SUMMARY_START") + len("SUMMARY_START")
            s_end = raw_response.find("SUMMARY_END")
            summary = raw_response[s_start:s_end].strip()
            
            k_start = raw_response.find("KEYWORDS:")
            if k_start != -1:
                k_text = raw_response[k_start + len("KEYWORDS:"):].strip()
                keywords = [k.strip() for k in k_text.split(',')]
    except Exception as e:
        print(f"Failed to parse structured format: {e}")

    # Generate a punchy title
    title_prompt = "Generate a short, punchy 5-word title based on this text. Respond ONLY with the title. Do not include quotes."
    title = get_openrouter_summary(summary, title_prompt).strip().replace('"', '')

    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    data_file = 'data.json'
    if os.path.exists(data_file):
        with open(data_file, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = {"links": [], "masterDigest": ""}
    else:
        data = {"links": [], "masterDigest": ""}

    new_link = {
        "title": title,
        "url": target_url,
        "summary": summary,
        "keywords": keywords,
        "date": date_str
    }
    
    data['links'].insert(0, new_link)
    data['links'] = data['links'][:50]
    data['lastGenerated'] = date_str

    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    gap_content = get_openrouter_gaps(keywords, title, summary)
    if gap_content:
        save_gap_to_file(title, target_url, keywords, gap_content)
        print("Knowledge gap analysis saved.")
    else:
        print("OpenRouter gap analysis skipped (no API key or no keywords).")

    make_rss(data)
    print("Successfully processed link.")

if __name__ == "__main__":
    main()
