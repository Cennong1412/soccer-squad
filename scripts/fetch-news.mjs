// 매일 GitHub Actions가 실행해 data/news.json을 갱신하는 스크립트.
// 외부 npm 패키지 없이 Node 내장 fetch + 정규식 기반 RSS 파싱만 사용합니다.
// 로컬에서 수동 실행: node scripts/fetch-news.mjs

import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const FEEDS = [
  { url: "https://www.theguardian.com/football/premierleague/rss", country: "England", countryLabel: "잉글랜드", source: "The Guardian" },
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", country: "England", countryLabel: "잉글랜드", source: "BBC Sport" },
  { url: "https://www.theguardian.com/football/mls/rss", country: "USA", countryLabel: "미국", source: "The Guardian" },
  { url: "https://www.theguardian.com/football/spain/rss", country: "Spain", countryLabel: "스페인", source: "The Guardian" },
  { url: "https://www.theguardian.com/football/germany/rss", country: "Germany", countryLabel: "독일", source: "The Guardian" },
];

const MAX_PER_FEED = 8;
const MAX_SUMMARY_LEN = 800;

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(block);
  if (!m) return "";
  let v = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(v);
  if (cdata) v = cdata[1];
  return decodeEntities(v.trim());
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml))) {
    const block = m[1];
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      description: extractTag(block, "description"),
      pubDate: extractTag(block, "pubDate"),
    });
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WorldSoccerSquadBot/1.0; +https://github.com/)" },
    });
    if (!res.ok) {
      console.error(`[skip] ${feed.url} -> HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = parseRSS(xml).slice(0, MAX_PER_FEED);
    return items
      .filter((it) => it.title && it.link)
      .map((it) => {
        const id = createHash("md5").update(it.link).digest("hex").slice(0, 12);
        return {
          id,
          title: stripHtml(it.title),
          summary: stripHtml(it.description).slice(0, MAX_SUMMARY_LEN),
          link: it.link.trim(),
          source: feed.source,
          country: feed.country,
          countryLabel: feed.countryLabel,
          pubDate: it.pubDate || null,
        };
      });
  } catch (e) {
    console.error(`[error] ${feed.url}:`, e.message);
    return [];
  }
}

async function main() {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const all = results.flat();

  const seen = new Set();
  const deduped = all.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  deduped.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

  const out = { generatedAt: new Date().toISOString(), articles: deduped };
  const outPath = fileURLToPath(new URL("../data/news.json", import.meta.url));
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`Wrote ${deduped.length} articles to ${outPath}`);
}

main();
