"""
Space news researcher for CH6 Red Space Facts.
Fetches recent space news via RSS feeds — no browser/YouTube scraping.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import feedparser

logger = logging.getLogger(__name__)

RSS_FEEDS = [
    {"name": "NASA Breaking News", "url": "https://www.nasa.gov/rss/dyn/breaking_news.rss", "weight": 1.0},
    {"name": "ESA Top News", "url": "https://www.esa.int/rssfeed.xml", "weight": 0.9},
    {"name": "Sky & Telescope", "url": "https://skyandtelescope.org/feed/", "weight": 0.85},
    {"name": "Phys.org Space", "url": "https://phys.org/rss-feed/space-news/", "weight": 0.8},
    {"name": "Space.com", "url": "https://www.space.com/feeds/all", "weight": 0.75},
    {"name": "EarthSky", "url": "https://earthsky.org/feed", "weight": 0.65},
]

SPACE_KEYWORDS = [
    "planet", "star", "galaxy", "nebula", "black hole", "neutron star", "exoplanet",
    "asteroid", "comet", "moon", "mars", "saturn", "jupiter", "mercury", "venus",
    "telescope", "nasa", "esa", "spacecraft", "orbit", "launch", "rover", "probe",
    "solar system", "milky way", "universe", "cosmos", "light year", "gravitational",
    "dark matter", "dark energy", "supernova", "pulsar", "quasar", "space station",
    "astronaut", "mission", "discovery", "observation", "webb", "hubble", "voyager",
    "atmosphere", "plasma", "radiation", "cosmic", "interstellar", "dwarf planet",
]


def _parse_date(entry) -> Optional[datetime]:
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6])
        if hasattr(entry, "updated_parsed") and entry.updated_parsed:
            return datetime(*entry.updated_parsed[:6])
    except Exception:
        pass
    return None


def _score_entry(entry, feed_weight: float) -> float:
    title = getattr(entry, "title", "").lower()
    summary = getattr(entry, "summary", "").lower()
    content = title + " " + summary

    keyword_hits = sum(1 for kw in SPACE_KEYWORDS if kw in content)
    relevance = min(keyword_hits / 3.0, 1.0)

    pub_date = _parse_date(entry)
    recency = 0.5
    if pub_date:
        age_days = (datetime.utcnow() - pub_date).days
        if age_days < 1:
            recency = 1.0
        elif age_days < 3:
            recency = 0.85
        elif age_days < 7:
            recency = 0.65
        else:
            recency = 0.3

    return feed_weight * (0.6 * relevance + 0.4 * recency)


def _clean_html(text: str) -> str:
    """Strip basic HTML tags from feed summaries."""
    import re
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fetch_space_news(max_stories: int = 10, max_age_days: int = 14) -> List[Dict[str, Any]]:
    """
    Fetch recent space news from RSS feeds.
    Returns stories sorted by relevance score (best first).
    """
    cutoff = datetime.utcnow() - timedelta(days=max_age_days)
    stories: List[Dict[str, Any]] = []

    for feed_info in RSS_FEEDS:
        url = feed_info["url"]
        weight = feed_info["weight"]
        name = feed_info["name"]

        for attempt in range(1, 3):
            try:
                feed = feedparser.parse(url)
                if feed.bozo and not feed.entries:
                    raise ValueError(f"Feed parse error: {feed.bozo_exception}")

                for entry in feed.entries[:25]:
                    pub_date = _parse_date(entry)
                    if pub_date and pub_date < cutoff:
                        continue

                    title = getattr(entry, "title", "").strip()
                    summary = _clean_html(getattr(entry, "summary", "").strip())
                    link = getattr(entry, "link", "").strip()

                    if not title:
                        continue

                    score = _score_entry(entry, weight)
                    stories.append({
                        "title": title,
                        "summary": summary[:600] if summary else "",
                        "source": name,
                        "url": link,
                        "published": pub_date.isoformat() if pub_date else "",
                        "score": score,
                    })

                logger.info("Fetched %d entries from %s", len(feed.entries), name)
                break
            except Exception as exc:
                logger.warning("Feed fetch attempt %d/2 failed for %s: %s", attempt, name, exc)
                if attempt < 2:
                    time.sleep(3)

    # Sort by score, deduplicate by title similarity
    stories.sort(key=lambda s: s["score"], reverse=True)
    seen: set = set()
    unique: List[Dict[str, Any]] = []
    for story in stories:
        key = story["title"].lower()[:60]
        if key not in seen:
            seen.add(key)
            unique.append(story)

    return unique[:max_stories]


if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO)
    results = fetch_space_news(max_stories=5)
    print(json.dumps(results, indent=2, default=str))
