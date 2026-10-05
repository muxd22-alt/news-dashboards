#!/usr/bin/env python3
"""
Tiered Memory Archive - Cold/Warm Storage Management for Private AI Newsroom

Memory Tiers:
  - Hot (Context):   scout_results.json, current session data
  - Warm (Fast):     data.json (last N days, kept as structured JSON for queries)
  - Cold (Archive):  memory/cold_archive.md (Markdown, append-only, human-readable)

Logic:
  1. Entries older than WARM_WINDOW_DAYS are moved from data.json → cold_archive.md
  2. Gaps whose research topic appears in data.json are marked "resolved"
  3. Resolved gaps are archived to cold_archive.md and removed from gaps.json
  4. Archive deduplication prevents re-archiving the same URL

Usage:
    python core/archive.py              # Archive with default 7-day window
    python core/archive.py --days 14    # Keep 14 days in warm storage
    python core/archive.py --dry-run    # Preview what would be archived
"""

import os
import sys
import json
import datetime
import argparse
import hashlib


# ============================================================================
# Configuration
# ============================================================================

DATA_FILE = 'data.json'
GAPS_FILE = 'gaps.json'
MEMORY_DIR = 'memory'
COLD_ARCHIVE_FILE = os.path.join(MEMORY_DIR, 'cold_archive.md')
RESOLVED_GAPS_FILE = os.path.join(MEMORY_DIR, 'resolved_gaps.json')
WARM_WINDOW_DAYS = 7
ARCHIVE_HEADER = "# Cold Archive — Private AI Newsroom\n\n> Entries older than {warm_window} days are archived here to prevent data.json bloat.\n> Format: Markdown, append-only.\n\n---\n"


# ============================================================================
# Warm → Cold: Archive old data.json entries
# ============================================================================

def parse_date(date_str):
    """Parse RFC 2822 date string from data.json entries."""
    try:
        return datetime.datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %z")
    except (ValueError, TypeError):
        # Fallback for ISO format or malformed dates
        try:
            return datetime.datetime.fromisoformat(date_str)
        except (ValueError, TypeError):
            return None


def normalize_url(url):
    """Normalize URL for deduplication."""
    url = url.lower().strip()
    url = url.split('?')[0].rstrip('/')
    if url.startswith('http://'):
        url = url[7:]
    if url.startswith('https://'):
        url = url[8:]
    if url.startswith('www.'):
        url = url[4:]
    return url


def load_existing_archive_urls():
    """Extract all URLs already in the cold archive to avoid duplicates."""
    if not os.path.exists(COLD_ARCHIVE_FILE):
        return set()

    urls = set()
    with open(COLD_ARCHIVE_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('- **URL:**'):
                url = line.replace('- **URL:**', '').strip()
                urls.add(normalize_url(url))
    return urls


def ensure_archive_exists():
    """Create memory/ directory and initialize cold_archive.md if needed."""
    if not os.path.exists(MEMORY_DIR):
        os.makedirs(MEMORY_DIR)

    if not os.path.exists(COLD_ARCHIVE_FILE):
        with open(COLD_ARCHIVE_FILE, 'w', encoding='utf-8') as f:
            f.write(ARCHIVE_HEADER.format(warm_window=WARM_WINDOW_DAYS))


def entry_hash(link):
    """Generate a short hash for a link entry (for dedup tracking)."""
    content = f"{link.get('url', '')}|{link.get('title', '')}"
    return hashlib.md5(content.encode('utf-8')).hexdigest()[:8]


def format_archive_entry(link):
    """Format a link entry as a Markdown archive section."""
    url = link.get('url', 'N/A')
    title = link.get('title', 'Unknown Title')
    date = link.get('date', 'Unknown Date')
    summary = link.get('summary', 'No summary available.')
    keywords = link.get('keywords', [])
    h = entry_hash(link)

    md = f"\n\n## [{title}] ({url})\n"
    md += f"<!-- hash: {h} -->\n"
    md += f"- **Date:** {date}\n"
    md += f"- **URL:** {url}\n"
    md += f"- **Keywords:** {', '.join(keywords) if keywords else 'None'}\n"
    md += f"\n### Summary\n{summary}\n"
    md += "\n---\n"
    return md


def archive_old_entries(dry_run=False, warm_days=WARM_WINDOW_DAYS):
    """
    Move entries older than warm_days from data.json (Warm) to cold_archive.md (Cold).

    Returns dict with: {archived_count, remaining_count, archived_entries}
    """
    if not os.path.exists(DATA_FILE):
        print("[ARCHIVE] No data.json found. Nothing to archive.")
        return {"archived_count": 0, "remaining_count": 0, "archived_entries": []}

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print("[ARCHIVE] Invalid JSON in data.json. Skipping.")
            return {"archived_count": 0, "remaining_count": 0, "archived_entries": []}

    links = data.get('links', [])
    if not links:
        print("[ARCHIVE] No links in data.json. Nothing to archive.")
        return {"archived_count": 0, "remaining_count": 0, "archived_entries": []}

    now = datetime.datetime.now(datetime.timezone.utc)
    cutoff = now - datetime.timedelta(days=warm_days)

    current_links = []
    archived_entries = []
    archived_count = 0

    # Load existing archive URLs for dedup
    existing_archive_urls = load_existing_archive_urls()

    for link in links:
        link_date = parse_date(link.get('date', ''))

        if link_date is None:
            # Can't parse date — keep in warm storage to be safe
            print(f"[ARCHIVE] WARNING: Unparseable date for '{link.get('title', 'Unknown')}'. Keeping in warm.")
            current_links.append(link)
            continue

        if link_date < cutoff:
            norm_url = normalize_url(link.get('url', ''))
            if norm_url in existing_archive_urls:
                # Already archived — just remove from warm
                print(f"[ARCHIVE] Skipping duplicate (already archived): {link.get('title', 'Unknown')}")
                archived_count += 1
                continue

            archived_entries.append(link)
            archived_count += 1

            if not dry_run:
                ensure_archive_exists()
                with open(COLD_ARCHIVE_FILE, 'a', encoding='utf-8') as af:
                    af.write(format_archive_entry(link))

            print(f"[ARCHIVE] Moved to cold: {link.get('title', 'Unknown')} ({link.get('date', '')})")
        else:
            current_links.append(link)

    # Update data.json with remaining warm entries
    if archived_count > 0 and not dry_run:
        data['links'] = current_links
        data['lastGenerated'] = now.strftime("%a, %d %b %Y %H:%M:%S +0000")
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    mode = "[DRY RUN] " if dry_run else ""
    print(f"\n{mode}[ARCHIVE] {archived_count} entries archived, {len(current_links)} remain in warm storage.")
    return {
        "archived_count": archived_count,
        "remaining_count": len(current_links),
        "archived_entries": archived_entries
    }


# ============================================================================
# Gap Resolution Tracking
# ============================================================================

def check_resolved_gaps(dry_run=False):
    """
    Check if any gaps in gaps.json have been resolved.

    A gap is considered "resolved" if:
    - Its title or a keyword now appears as a title/keyword in data.json
    - OR its original URL now exists in data.json (scout successfully fed the loop)

    Returns dict with: {resolved_gaps, still_open_count}
    """
    if not os.path.exists(GAPS_FILE):
        print("[ARCHIVE] No gaps.json found. Nothing to check.")
        return {"resolved_gaps": [], "still_open_count": 0}

    with open(GAPS_FILE, 'r', encoding='utf-8') as f:
        try:
            gaps_data = json.load(f)
        except json.JSONDecodeError:
            print("[ARCHIVE] Invalid JSON in gaps.json. Skipping gap resolution.")
            return {"resolved_gaps": [], "still_open_count": 0}

    gaps = gaps_data.get('gaps', [])
    if not gaps:
        print("[ARCHIVE] No gaps to check.")
        return {"resolved_gaps": [], "still_open_count": 0}

    # Load current knowledge base
    data_links = []
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                data_links = data.get('links', [])
            except json.JSONDecodeError:
                pass

    # Build lookup sets
    data_urls = set()
    data_titles_lower = set()
    data_keywords = set()

    for link in data_links:
        data_urls.add(normalize_url(link.get('url', '')))
        data_titles_lower.add(link.get('title', '').lower())
        for kw in link.get('keywords', []):
            data_keywords.add(kw.lower())

    resolved = []
    still_open = []

    for gap in gaps:
        gap_title = gap.get('title', '').lower()
        gap_url = normalize_url(gap.get('url', ''))
        gap_keywords = [kw.lower() for kw in gap.get('keywords', [])]
        gap_text = gap.get('gap', '').lower()

        # Resolution checks
        is_resolved = False
        resolution_reason = ""

        # Check 1: Gap's original URL now in data.json
        if gap_url and gap_url in data_urls:
            is_resolved = True
            resolution_reason = "URL now in data.json (scout loop closed)"

        # Check 2: Gap title matches a data.json entry title
        elif gap_title and gap_title in data_titles_lower:
            is_resolved = True
            resolution_reason = "Title match found in warm storage"

        # Check 3: Any gap keyword now appears in data.json keywords
        elif any(kw in data_keywords for kw in gap_keywords):
            is_resolved = True
            resolution_reason = f"Keyword match in warm storage ({', '.join(gap_keywords[:2])})"

        # Check 4: Gap topic text appears in any data.json summary
        elif any(gap_text[:50] in link.get('summary', '').lower() for link in data_links if len(gap_text) > 50):
            is_resolved = True
            resolution_reason = "Gap topic found in summary content"

        if is_resolved:
            resolved.append({
                "gap": gap,
                "resolution_reason": resolution_reason,
                "resolved_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })
            print(f"[ARCHIVE] ✅ Resolved: {gap.get('title', 'Unknown')} — {resolution_reason}")
        else:
            still_open.append(gap)

    # Archive resolved gaps
    if resolved and not dry_run:
        ensure_archive_exists()

        # Write to cold archive
        with open(COLD_ARCHIVE_FILE, 'a', encoding='utf-8') as af:
            af.write("\n## Resolved Knowledge Gaps\n\n")
            for r in resolved:
                gap = r['gap']
                af.write(f"### ✅ {gap.get('title', 'Unknown')}\n")
                af.write(f"- **Resolved:** {r['resolved_at']}\n")
                af.write(f"- **Reason:** {r['resolution_reason']}\n")
                af.write(f"- **Original Gap:** {gap.get('gap', '')[:200]}...\n\n")
            af.write("---\n")

        # Track in resolved_gaps.json
        resolved_log = []
        if os.path.exists(RESOLVED_GAPS_FILE):
            with open(RESOLVED_GAPS_FILE, 'r', encoding='utf-8') as f:
                try:
                    resolved_log = json.load(f)
                except json.JSONDecodeError:
                    resolved_log = []

        resolved_log.extend(resolved)
        with open(RESOLVED_GAPS_FILE, 'w', encoding='utf-8') as f:
            json.dump(resolved_log, f, indent=2, ensure_ascii=False)

        # Update gaps.json to remove resolved entries
        gaps_data['gaps'] = still_open
        gaps_data['lastUpdated'] = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%a, %d %b %Y %H:%M:%S +0000"
        )
        with open(GAPS_FILE, 'w', encoding='utf-8') as f:
            json.dump(gaps_data, f, indent=2, ensure_ascii=False)

    mode = "[DRY RUN] " if dry_run else ""
    print(f"\n{mode}[ARCHIVE] {len(resolved)} gaps resolved, {len(still_open)} still open.")
    return {"resolved_gaps": resolved, "still_open_count": len(still_open)}


# ============================================================================
# Archive Summary Report
# ============================================================================

def generate_summary():
    """Print a summary of the current memory state."""
    print("\n" + "=" * 60)
    print("[ARCHIVE] Memory Tier Summary")
    print("=" * 60)

    # Warm storage
    warm_count = 0
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                warm_count = len(data.get('links', []))
            except json.JSONDecodeError:
                pass
    print(f"  Warm (data.json):     {warm_count} entries")

    # Cold archive
    cold_count = 0
    if os.path.exists(COLD_ARCHIVE_FILE):
        with open(COLD_ARCHIVE_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            cold_count = content.count('<!-- hash:')
    print(f"  Cold (archive.md):    {cold_count} entries")

    # Gaps
    gap_count = 0
    if os.path.exists(GAPS_FILE):
        with open(GAPS_FILE, 'r', encoding='utf-8') as f:
            try:
                gaps = json.load(f)
                gap_count = len(gaps.get('gaps', []))
            except json.JSONDecodeError:
                pass
    print(f"  Open Gaps:            {gap_count}")

    # Resolved gaps
    resolved_count = 0
    if os.path.exists(RESOLVED_GAPS_FILE):
        with open(RESOLVED_GAPS_FILE, 'r', encoding='utf-8') as f:
            try:
                resolved = json.load(f)
                resolved_count = len(resolved) if isinstance(resolved, list) else 0
            except json.JSONDecodeError:
                pass
    print(f"  Resolved Gaps:        {resolved_count}")

    # Scout results
    scout_file = 'scout_results.json'
    if os.path.exists(scout_file):
        with open(scout_file, 'r', encoding='utf-8') as f:
            try:
                scout = json.load(f)
                scout_urls = sum(
                    len(g.get('found_urls', []))
                    for g in scout.get('scout_results', [])
                )
                print(f"  Hot (scout results):    {scout_urls} URLs pending")
            except json.JSONDecodeError:
                pass
    else:
        print(f"  Hot (scout results):    No active scout")

    print("=" * 60)


# ============================================================================
# CLI Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Tiered Memory Archive — Warm/Cold storage management'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=WARM_WINDOW_DAYS,
        help=f'Days to keep in warm storage (default: {WARM_WINDOW_DAYS})'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview what would be archived without making changes'
    )
    parser.add_argument(
        '--summary',
        action='store_true',
        help='Show memory tier summary and exit'
    )

    args = parser.parse_args()

    if args.summary:
        generate_summary()
        return

    print("=" * 60)
    print("[ARCHIVE] Tiered Memory Archive")
    print("=" * 60)
    print(f"[ARCHIVE] Warm window: {args.days} days")
    print(f"[ARCHIVE] Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")

    # Phase 1: Archive old entries
    print("\n--- Phase 1: Warm → Cold ---")
    archive_result = archive_old_entries(dry_run=args.dry_run, warm_days=args.days)

    # Phase 2: Check resolved gaps
    print("\n--- Phase 2: Gap Resolution ---")
    gap_result = check_resolved_gaps(dry_run=args.dry_run)

    # Summary
    generate_summary()


if __name__ == "__main__":
    main()
