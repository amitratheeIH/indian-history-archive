#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║  INDIAN HISTORY ARCHIVE — JSON Splitter                      ║
║  Run once whenever you update data.json                       ║
║                                                              ║
║  Usage:                                                      ║
║    python split_data.py                                      ║
║                                                              ║
║  What it does:                                               ║
║    1. Reads data.json (your single master file)              ║
║    2. Writes data/index.json  — lightweight, loaded on boot  ║
║    3. Writes data/<slug>.json — one file per category        ║
║                                                              ║
║  You keep editing data.json as normal.                       ║
║  Re-run this script after any edit before deploying.         ║
╚══════════════════════════════════════════════════════════════╝
"""

import json
import os
import re
import sys
from collections import defaultdict

# ── Config ──────────────────────────────────────────────────
SOURCE_FILE  = "data.json"          # your master file
OUTPUT_DIR   = "data"               # folder for chunk files
INDEX_FILE   = "data/index.json"    # lightweight manifest

# Fields kept in index.json (fast lookup, filtering, sidebar)
INDEX_FIELDS = [
    "id", "title", "type",
    "categories", "subcategories", "tags",
    "period", "dynasty", "region",
    "language", "source_type", "file_format",
    "featured", "url",
    # small display fields needed for cards in category browse
    "description", "authors", "source", "paper", "module_id",
    "alternate_urls",
]

# ── Helpers ─────────────────────────────────────────────────
def slugify(text):
    """Convert 'Ancient India' → 'ancient-india'"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text

def pick(record, fields):
    return {k: record[k] for k in fields if k in record}

# ── Main ────────────────────────────────────────────────────
def split():
    if not os.path.exists(SOURCE_FILE):
        print(f"✗  {SOURCE_FILE} not found. Run from the same folder as your website files.")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(SOURCE_FILE, "r", encoding="utf-8") as f:
        records = json.load(f)

    print(f"✓  Loaded {len(records)} records from {SOURCE_FILE}")

    # ── 1. Build index.json ──────────────────────────────────
    index = [pick(r, INDEX_FIELDS) for r in records]

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))

    index_kb = os.path.getsize(INDEX_FILE) / 1024
    print(f"✓  Wrote {INDEX_FILE}  ({index_kb:.1f} KB, {len(index)} records)")

    # ── 2. Group records by every category they belong to ────
    by_category = defaultdict(list)
    for record in records:
        for cat in record.get("categories", []):
            by_category[cat].append(record)

    # ── 3. Write one chunk file per category ─────────────────
    manifest = {}   # category → filename, stored inside index.json

    for cat, cat_records in sorted(by_category.items()):
        slug     = slugify(cat)
        filename = f"{slug}.json"
        filepath = os.path.join(OUTPUT_DIR, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(cat_records, f, ensure_ascii=False, separators=(',', ':'))

        size_kb = os.path.getsize(filepath) / 1024
        manifest[cat] = filename
        print(f"   ↳  {filepath}  ({size_kb:.1f} KB, {len(cat_records)} records)")

    # ── 4. Inject manifest into index.json ───────────────────
    index_meta = {
        "_meta": {
            "total":     len(records),
            "generated": __import__('datetime').datetime.utcnow().isoformat() + "Z",
            "chunks":    manifest,       # { "Ancient India": "ancient-india.json", ... }
        },
        "records": index
    }

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index_meta, f, ensure_ascii=False, separators=(',', ':'))

    print(f"\n✓  Done. {len(by_category)} category chunks written.")
    print(f"   Deploy the '{OUTPUT_DIR}/' folder alongside your website files.")
    print(f"\n   File sizes:")
    print(f"   {'data.json':<30} {os.path.getsize(SOURCE_FILE)/1024:.1f} KB  (do not deploy — source only)")
    print(f"   {'data/index.json':<30} {os.path.getsize(INDEX_FILE)/1024:.1f} KB  (loaded on every page visit)")
    total_chunks = sum(
        os.path.getsize(os.path.join(OUTPUT_DIR, fn))
        for fn in manifest.values()
    )
    print(f"   {'All chunks combined':<30} {total_chunks/1024:.1f} KB  (fetched on demand)")

if __name__ == "__main__":
    split()
