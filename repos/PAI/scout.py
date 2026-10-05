#!/usr/bin/env python3
"""
Scout Module - Proactive Gap Resolution for Private AI Newsroom

Reads knowledge gaps from gaps.json, formulates search queries,
finds resolving content, and optionally auto-submits URLs back
into the pipeline via GitHub Issues API.

Usage:
    python scout.py                  # Output-only mode (default)
    python scout.py --auto           # Auto-submit found URLs as GitHub Issues
    python scout.py --limit 5        # Scout top 5 gaps (default: 3)
    python scout.py --dry-run        # Show what would be submitted without API calls
"""

import os
import sys
import json
import datetime
import re
import time
import argparse
import urllib.request
import urllib.parse


# ============================================================================
# Configuration
# ============================================================================

GAPS_FILE = 'gaps.json'
DATA_FILE = 'data.json'
SCOUT_OUTPUT = 'scout_results.json'
MAX_GAPS_DEFAULT = 3
MAX_URLS_PER_GAP = 3
MIN_RELEVANCE_SCORE = 0.3  # Minimum confidence to include a URL


# ============================================================================
# Gap Parser
# ============================================================================

def load_gaps(filepath=GAPS_FILE):
    """Load and return gaps from gaps.json."""
    if not os.path.exists(filepath):
        print(f"[SCOUT] No gaps file found at {filepath}. Nothing to scout.")
        return []

    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"[SCOUT] Invalid JSON in {filepath}.")
            return []

    gaps = data.get('gaps', [])
    if not gaps:
        print("[SCOUT] No gaps to resolve. Your knowledge base is current!")
        return []

    print(f"[SCOUT] Loaded {len(gaps)} gaps from {filepath}")
    return gaps


def extract_research_topics(gap_entry):
    """
    Parse a gap entry to extract researchable topics.

    Gap format from process_links.py:
    {
        "title": "Article Title",
        "url": "original_url",
        "keywords": ["kw1", "kw2"],
        "gap": "1. [Topic] — [Reason]\n2. [Topic] — [Reason]\n3. [Topic] — [Reason]",
        "date": "..."
    }

    Returns list of (topic, reason) tuples.
    """
    gap_text = gap_entry.get('gap', '')
    keywords = gap_entry.get('keywords', [])
    title = gap_entry.get('title', '')

    topics = []

    # Parse numbered list format: "1. [Topic] — [Reason]"
    pattern = r'\d+\.\s*\[([^\]]+)\]\s*[—\-–:]\s*(.+?)(?=\d+\.\s*\[|$)'
    matches = re.findall(pattern, gap_text, re.DOTALL)

    for topic, reason in matches:
        topic = topic.strip()
        reason = reason.strip()
        if topic and len(topic) > 3:  # Filter out tiny fragments
            topics.append((topic, reason))

    # Fallback: if no structured topics found, use keywords as research seeds
    if not topics and keywords:
        for kw in keywords[:3]:
            topics.append((kw, f"Follow-up research on {kw} related to '{title}'"))

    # Fallback: use title itself as research topic
    if not topics and title:
        topics.append((title, f"Broader context and related research for '{title}'"))

    return topics


def load_existing_urls(filepath=DATA_FILE):
    """Load all URLs already in data.json for deduplication."""
    if not os.path.exists(filepath):
        return set()

    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return set()

    urls = set()
    for link in data.get('links', []):
        url = link.get('url', '')
        if url:
            urls.add(normalize_url(url))

    # Also check gaps.json for already-scouted URLs
    gaps_file = 'gaps.json'
    if os.path.exists(gaps_file):
        with open(gaps_file, 'r', encoding='utf-8') as f:
            try:
                gaps_data = json.load(f)
                for gap in gaps_data.get('gaps', []):
                    url = gap.get('url', '')
                    if url:
                        urls.add(normalize_url(url))
            except json.JSONDecodeError:
                pass

    return urls


def normalize_url(url):
    """Normalize URL for deduplication comparison."""
    # Strip protocol and www
    url = re.sub(r'^https?://(www\.)?', '', url.lower())
    # Remove query parameters (keep base URL for matching)
    url = url.split('?')[0]
    # Remove trailing slash
    url = url.rstrip('/')
    return url


# ============================================================================
# Search Engines
# ============================================================================

def search_tavily(query, max_results=5):
    """
    Search using Tavily API (recommended for quality).
    Requires TAVILY_API_KEY environment variable.
    Returns list of (url, snippet, score) tuples.
    """
    api_key = os.environ.get('TAVILY_API_KEY')
    if not api_key:
        print("[SCOUT] TAVILY_API_KEY not set. Skipping Tavily search.")
        return []

    url = "https://api.tavily.com/search"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": "basic",
        "include_answer": False
    }

    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode('utf-8'))

        results = []
        for item in result.get('results', []):
            results.append((
                item.get('url', ''),
                item.get('content', ''),
                item.get('score', 0.5)
            ))

        print(f"[SCOUT] Tavily returned {len(results)} results for: {query[:50]}...")
        return results

    except Exception as e:
        print(f"[SCOUT] Tavily search failed: {e}")
        return []


def search_duckduckgo(query, max_results=5):
    """
    Search using DuckDuckGo (no API key required).
    Uses the duckduckgo-search package if available, falls back to HTML scraping.
    Returns list of (url, snippet, score) tuples.
    """
    # Try using ddgs package first (renamed from duckduckgo-search)
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))

        formatted = []
        for r in results:
            url = r.get('href', '')
            snippet = r.get('body', '')
            # DuckDuckGo doesn't provide relevance scores, estimate from snippet quality
            score = min(0.8, 0.3 + len(snippet) / 500)
            formatted.append((url, snippet, score))

        print(f"[SCOUT] DuckDuckGo (ddgs) returned {len(formatted)} results for: {query[:50]}...")
        return formatted

    except ImportError:
        print("[SCOUT] ddgs package not installed. Trying duckduckgo-search...")
        # Backward compat with old package name
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))

            formatted = []
            for r in results:
                url = r.get('href', '')
                snippet = r.get('body', '')
                score = min(0.8, 0.3 + len(snippet) / 500)
                formatted.append((url, snippet, score))

            print(f"[SCOUT] DuckDuckGo (duckduckgo_search) returned {len(formatted)} results for: {query[:50]}...")
            return formatted
        except ImportError:
            print("[SCOUT] duckduckgo-search package also not available. Falling back to HTML.")
        except Exception as e:
            print(f"[SCOUT] duckduckgo-search failed: {e}. Falling back.")
    except Exception as e:
        print(f"[SCOUT] ddgs search failed: {e}. Falling back.")

    # Fallback: Use DuckDuckGo Lite HTML scraping
    return _search_duckduckgo_html(query, max_results)


def _search_duckduckgo_html(query, max_results=5):
    """
    Fallback DuckDuckGo search using HTML scraping.
    Less reliable but requires no dependencies.
    """
    encoded_query = urllib.parse.quote_plus(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded_query}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8')

        # Extract URLs and snippets from HTML
        urls = re.findall(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"', html)
        snippets = re.findall(r'<a[^>]+class="result__snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)</a>', html)

        results = []
        for i, url in enumerate(urls[:max_results]):
            # DuckDuckGo wraps URLs in redirects, unwrap them
            if '/uddg?' in url:
                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
                url = parsed.get('uddg', [url])[0]

            snippet = snippets[i] if i < len(snippets) else ''
            # Clean HTML tags from snippet
            snippet = re.sub(r'<[^>]+>', '', snippet)
            score = min(0.7, 0.3 + len(snippet) / 600)
            results.append((url, snippet, score))

        print(f"[SCOUT] DuckDuckGo (HTML) returned {len(results)} results for: {query[:50]}...")
        return results

    except Exception as e:
        print(f"[SCOUT] DuckDuckGo HTML scraping failed: {e}")
        return []


def search(query, max_results=5):
    """
    Multi-engine search: Tavily first (if configured), DuckDuckGo fallback.
    Returns list of (url, snippet, score) tuples.
    """
    # Try Tavily first
    results = search_tavily(query, max_results)
    if results:
        return results

    # Fallback to DuckDuckGo
    results = search_duckduckgo(query, max_results)
    return results


# ============================================================================
# Scout Logic
# ============================================================================

def scout_gaps(limit=MAX_GAPS_DEFAULT, max_urls=MAX_URLS_PER_GAP):
    """
    Main scout function.

    1. Load gaps from gaps.json
    2. Extract research topics
    3. Search for resolving content
    4. Deduplicate against existing URLs
    5. Return ranked results

    Returns dict with scout results.
    """
    gaps = load_gaps()
    if not gaps:
        return {"scout_results": [], "scouted_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}

    existing_urls = load_existing_urls()
    print(f"[SCOUT] Deduplicating against {len(existing_urls)} known URLs")

    # Process top N gaps
    gaps_to_process = gaps[:limit]
    results = []

    for i, gap in enumerate(gaps_to_process):
        print(f"\n{'='*60}")
        print(f"[SCOUT] Processing gap #{i+1}: {gap.get('title', 'Unknown')}")

        topics = extract_research_topics(gap)
        print(f"[SCOUT] Extracted {len(topics)} research topic(s)")

        gap_results = []

        for topic, reason in topics:
            # Formulate search query: combine topic + context keywords
            keywords = gap.get('keywords', [])
            search_query = f"{topic} {' '.join(keywords[:2])}".strip()

            print(f"[SCOUT] Searching: {search_query[:80]}...")

            # Execute search
            search_results = search(search_query, max_results=max_urls * 2)  # Get extras for dedup

            # Deduplicate and rank
            for url, snippet, score in search_results:
                norm_url = normalize_url(url)
                if norm_url in existing_urls:
                    print(f"[SCOUT] Skipping duplicate: {url[:60]}...")
                    continue

                # Filter out low-relevance results
                if score < MIN_RELEVANCE_SCORE:
                    continue

                gap_results.append({
                    "url": url,
                    "snippet": snippet[:200],
                    "confidence": round(score, 3),
                    "search_query": search_query
                })

                if len(gap_results) >= max_urls:
                    break

            if len(gap_results) >= max_urls:
                break

        # Sort by confidence
        gap_results.sort(key=lambda x: x['confidence'], reverse=True)
        gap_results = gap_results[:max_urls]

        results.append({
            "gap_topic": gap.get('title', 'Unknown'),
            "gap_date": gap.get('date', ''),
            "research_topics": [t[0] for t in topics],
            "found_urls": gap_results,
            "gap_reason": topics[0][1] if topics else ''
        })

        # Rate limiting between gaps
        if i < len(gaps_to_process) - 1:
            time.sleep(1)

    output = {
        "scout_results": results,
        "scouted_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_gaps_available": len(gaps),
        "gaps_processed": len(gaps_to_process)
    }

    # Write results to file
    with open(SCOUT_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"[SCOUT] Results written to {SCOUT_OUTPUT}")

    # Summary
    total_urls_found = sum(len(r['found_urls']) for r in results)
    print(f"[SCOUT] Found {total_urls_found} URLs across {len(results)} gaps")

    return output


# ============================================================================
# Auto-Submit Mode
# ============================================================================

def submit_to_github_issues(urls, dry_run=False):
    """
    Submit found URLs back into the pipeline via GitHub Issues API.
    This closes the loop: gaps → search → new issues → process_links → resolved gaps.

    Requires:
        GITHUB_TOKEN (with repo:issues scope)
        GITHUB_REPO (format: owner/repo)
    """
    token = os.environ.get('GITHUB_TOKEN')
    repo = os.environ.get('GITHUB_REPO', '')

    if not token:
        print("[SCOUT] GITHUB_TOKEN not set. Cannot auto-submit.")
        return False

    if not repo:
        print("[SCOUT] GITHUB_REPO not set (format: owner/repo). Cannot auto-submit.")
        return False

    api_url = f"https://api.github.com/repos/{repo}/issues"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }

    submitted = 0
    for url_entry in urls:
        url = url_entry['url']
        topic = url_entry.get('search_query', 'Unknown topic')

        title = f"Scout: Research on {topic[:80]}"
        body = f"""Automatically discovered by Scout module.

**Research Topic:** {topic}
**Source URL:** {url}
**Confidence:** {url_entry.get('confidence', 0)}

{url_entry.get('snippet', '')[:300]}

---
*This issue was auto-generated by the Scout gap-resolution system.*
"""

        if dry_run:
            print(f"[SCOUT] [DRY RUN] Would submit: {title}")
            print(f"[SCOUT] [DRY RUN] URL: {url}")
            submitted += 1
            continue

        payload = {
            "title": title,
            "body": body,
            "labels": ["scout", "gap-resolution"]
        }

        try:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(api_url, data=data, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=15) as response:
                issue_data = json.loads(response.read().decode('utf-8'))
                print(f"[SCOUT] Submitted Issue #{issue_data['number']}: {title[:60]}...")
                submitted += 1
                # Rate limit: 1 issue per 2 seconds
                time.sleep(2)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else str(e)
            print(f"[SCOUT] Failed to submit {url[:60]}...: HTTP {e.code} - {error_body}")
        except Exception as e:
            print(f"[SCOUT] Failed to submit {url[:60]}...: {e}")

    mode = "DRY RUN" if dry_run else "LIVE"
    print(f"\n[SCOUT] [{mode}] Submitted {submitted} URLs to GitHub Issues")
    return True


def collect_all_urls(scout_results):
    """Flatten scout results into a list of URL entries for submission."""
    urls = []
    for gap_result in scout_results.get('scout_results', []):
        urls.extend(gap_result.get('found_urls', []))
    return urls


# ============================================================================
# CLI Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Scout - Proactive gap resolution for Private AI Newsroom'
    )
    parser.add_argument(
        '--auto',
        action='store_true',
        help='Auto-submit found URLs as GitHub Issues (closes the loop)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=MAX_GAPS_DEFAULT,
        help=f'Number of gaps to scout (default: {MAX_GAPS_DEFAULT})'
    )
    parser.add_argument(
        '--max-urls',
        type=int,
        default=MAX_URLS_PER_GAP,
        help=f'Max URLs to find per gap (default: {MAX_URLS_PER_GAP})'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be submitted without making API calls'
    )

    args = parser.parse_args()

    print("=" * 60)
    print("[SCOUT] Private AI Newsroom - Gap Resolution Module")
    print("=" * 60)

    # Run scout
    results = scout_gaps(limit=args.limit, max_urls=args.max_urls)

    # Auto-submit mode
    if args.auto:
        print("\n" + "=" * 60)
        print("[SCOUT] Auto-submit mode enabled")
        print("=" * 60)

        urls = collect_all_urls(results)
        if not urls:
            print("[SCOUT] No URLs found to submit.")
        else:
            submit_to_github_issues(urls, dry_run=args.dry_run)
    else:
        print("\n[SCOUT] Output-only mode. Review results in scout_results.json")
        print("[SCOUT] Use --auto to auto-submit as GitHub Issues")

    # Print summary table
    if results.get('scout_results'):
        print("\n" + "=" * 60)
        print("[SCOUT] Summary")
        print("=" * 60)
        for gap in results['scout_results']:
            url_count = len(gap['found_urls'])
            status = f"✅ {url_count} URL(s) found" if url_count > 0 else "❌ No URLs found"
            print(f"  {gap['gap_topic'][:50]:50s} {status}")


if __name__ == "__main__":
    main()
