// 매일 GitHub Actions가 실행해 data/news.json을 갱신하는 스크립트.
// 외부 npm 패키지 없이 Node 내장 fetch + 정규식 기반 RSS 파싱만 사용합니다.
// 스페인/독일 현지 언론(Marca, Kicker)은 MyMemory 무료 번역 API로 영어로 번역합니다.
// 로컬에서 수동 실행: node scripts/fetch-news.mjs

import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const FEEDS = [
  { url: "https://www.theguardian.com/football/premierleague/rss", country: "England", countryLabel: "잉글랜드", source: "The Guardian" },
  { url: "https://www.theguardian.com/football/mls/rss", country: "USA", countryLabel: "미국", source: "The Guardian" },
  { url: "https://www.theguardian.com/football/spain/rss", country: "Spain", countryLabel: "스페인", source: "The Guardian" },
  { url: "https://www.theguardian.com/football/germany/rss", country: "Germany", countryLabel: "독일", source: "The Guardian" },
  { url: "https://www.marca.com/rss/futbol/primera-division.xml", country: "Spain", countryLabel: "스페인", source: "Marca", translateFrom: "es" },
  { url: "https://newsfeed.kicker.de/news/bundesliga", country: "Germany", countryLabel: "독일", source: "Kicker", translateFrom: "de" },
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// MyMemory 무료 번역 API (키 불필요, 요청당 길이 제한이 있어 500자로 자름)
async function translateText(text, from) {
  if (!text) return text;
  const truncated = text.slice(0, 480);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(truncated)}&langpair=${from}|en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (!translated || /INVALID|QUERY LENGTH LIMIT/i.test(translated)) return null;
    return decodeEntities(translated);
  } catch (e) {
    console.error(`[translate error] ${e.message}`);
    return null;
  }
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
    const items = parseRSS(xml).slice(0, MAX_PER_FEED).filter((it) => it.title && it.link);

    const articles = [];
    for (const it of items) {
      let title = stripHtml(it.title);
      let summary = stripHtml(it.description).slice(0, MAX_SUMMARY_LEN);

      if (feed.translateFrom) {
        const [tTitle, tSummary] = await Promise.all([
          translateText(title, feed.translateFrom),
          translateText(summary, feed.translateFrom),
        ]);
        await sleep(400); // MyMemory 요청 속도 제한 회피
        if (!tTitle || !tSummary) {
          console.error(`[skip translation-failed] ${it.link}`);
          continue; // 번역 실패 시 원문(스페인어/독일어)을 그대로 노출하지 않고 건너뜀
        }
        title = tTitle;
        summary = tSummary;
      }

      const id = createHash("md5").update(it.link).digest("hex").slice(0, 12);
      articles.push({
        id,
        title,
        summary,
        link: it.link.trim(),
        source: feed.source,
        country: feed.country,
        countryLabel: feed.countryLabel,
        pubDate: it.pubDate || null,
        translated: !!feed.translateFrom,
        translateFrom: feed.translateFrom || null,
      });
    }
    return articles;
  } catch (e) {
    console.error(`[error] ${feed.url}:`, e.message);
    return [];
  }
}

async function main() {
  // 번역 대상 피드는 순차 요청(속도 제한 회피), 나머지는 병렬로 처리
  const translateFeeds = FEEDS.filter((f) => f.translateFrom);
  const plainFeeds = FEEDS.filter((f) => !f.translateFrom);

  const plainResults = await Promise.all(plainFeeds.map(fetchFeed));
  const translateResults = [];
  for (const feed of translateFeeds) {
    translateResults.push(await fetchFeed(feed));
  }

  const all = [...plainResults.flat(), ...translateResults.flat()];

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
