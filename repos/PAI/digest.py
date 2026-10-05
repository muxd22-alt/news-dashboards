import os
import json
import datetime
import requests
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

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
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        return result['choices'][0]['message']['content']
    except Exception as e:
        print(f"Error calling OpenRouter API: {e}")
        return "Failed to generate summary using OpenRouter API."

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

def get_openrouter_gap_filler(keywords):
    api_key = os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        return "\n\n*(Add OPENROUTER_API_KEY to Github Secrets to enable the Knowledge Gap Filler)*"
    
    if not keywords:
        return ""

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = f"""Analyze these topics a user has been researching today: {', '.join(keywords)}.

CRITICAL RULES: 
- NEVER say you don't have enough information.
- NEVER ask the user to share more details.
- Work with EXACTLY the topics provided above.
- Be SPECIFIC to these exact topics, not generic.

Identify ONE critical blind spot or knowledge gap in their research portfolio. What emerging trend, regulatory shift, competitive dynamic, or technical risk are they NOT tracking that could materially impact their understanding? Write a single focused paragraph (4-6 sentences) explaining the gap, why it matters, and specific terms/concepts they should research next."""
    
    payload = {
        "model": "minimax/minimax-m2.5:free",
        "messages": [
            {"role": "system", "content": "You are a senior tech analyst offering strategic research advice. You MUST work with whatever information is provided. Never say you lack information or ask for more context. Be specific and actionable."},
            {"role": "user", "content": prompt}
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        return "\n\n### 🧠 Knowledge Gap Analysis\n" + content
    except Exception as e:
        print(f"Error calling OpenRouter: {e}")
        return ""

def main():
    data_file = 'data.json'
    if not os.path.exists(data_file):
        print("No data.json found. Exiting.")
        return

    with open(data_file, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print("Invalid JSON format in data.json. Exiting.")
            return

    all_links = data.get('links', [])
    all_keywords = set()
    
    for link in all_links:
        all_keywords.update(link.get('keywords', []))

    if not all_links:
        print("No links found. Skipping digest.")
        return

    combined_text = "\n\n".join([f"Title: {link['title']}\nSummary: {link['summary']}" for link in all_links])
    
    system_prompt = """You are an expert intelligence analyst writing a daily executive briefing. Analyze the following content and write a structured 300-word executive summary.

Your summary MUST follow this structure:
1. **The Trend** — What common theme or narrative thread connects today's content?
2. **Key Insights** — What are the 2-3 most important takeaways?
3. **Strategic Implications** — What should a tech leader or investor do with this information?

CRITICAL RULES:
- NEVER say you don't have enough information.
- NEVER ask for more context or details.
- Work with EXACTLY the content provided below.
- Be analytical, not descriptive — interpret, don't just summarize.
- Write in a confident, authoritative voice."""
    master_digest = get_openrouter_summary(combined_text, system_prompt)

    gap_filler = get_openrouter_gap_filler(list(all_keywords))

    data['masterDigest'] = master_digest + gap_filler
    data['lastGenerated'] = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    make_rss(data)
    print("Successfully generated daily digest.")

if __name__ == "__main__":
    main()
