import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const feedQueries = [
  "(stocks OR earnings OR ETF OR Nasdaq OR \"S&P 500\") when:1d",
  "(bitcoin OR ethereum OR crypto) when:1d",
  "(\"Federal Reserve\" OR inflation OR oil OR gold OR bonds) when:1d",
];
const FEED_URLS = feedQueries.map(
  (q) =>
    `https://news.google.com/rss/search?${new URLSearchParams({
      q,
      hl: "en-US",
      gl: "US",
      ceid: "US:en",
    })}`,
);
const OUTPUT_PATH = new URL("../data/global-news.json", import.meta.url);
const token = process.env.GITHUB_TOKEN;

if (!token) throw new Error("GITHUB_TOKEN is required for Georgian translation");

function decode(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  return decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]);
}

function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const combinedTitle = tag(match[1], "title");
      const separator = combinedTitle.lastIndexOf(" - ");
      const title = separator > 0 ? combinedTitle.slice(0, separator) : combinedTitle;
      const source = separator > 0 ? combinedTitle.slice(separator + 3) : "Global news";
      const url = tag(match[1], "link");
      const publishedAt = new Date(tag(match[1], "pubDate")).toISOString();
      return {
        id: createHash("sha256").update(url).digest("hex").slice(0, 16),
        title,
        source,
        url,
        publishedAt,
      };
    })
    .filter((item) => item.title && item.url.startsWith("https://"))
    .filter((item, index, rows) => rows.findIndex((row) => row.title === item.title) === index);
}

async function translate(items) {
  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a careful Georgian financial news editor. Translate headlines faithfully into natural Georgian. Write one concise Georgian explanatory sentence using only facts explicitly present in the supplied English headline. Never invent numbers, causes, forecasts, quotes, or investment advice. Return valid JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            requiredShape: {
              articles: [
                {
                  id: "same input id",
                  titleKa: "faithful Georgian headline",
                  summaryKa: "one factual Georgian sentence",
                  category: "აქციები | კრიპტო | ETF | ეკონომიკა | კომპანიები",
                },
              ],
            },
            articles: items.map(({ id, title, source }) => ({ id, title, source })),
          }),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`GitHub Models returned ${response.status}`);
  const payload = await response.json();
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
  const rows = parsed.articles ?? parsed.requiredShape?.articles ?? [];
  return new Map(rows.map((item) => [item.id, item]));
}

const feedResponses = await Promise.all(
  FEED_URLS.map((url) =>
    fetch(url, { headers: { "user-agent": "Investors.ge global news monitor/1.0" } }),
  ),
);
if (feedResponses.some((response) => !response.ok)) {
  throw new Error(`Global news feed failed: ${feedResponses.map((response) => response.status).join(",")}`);
}
const trustedSources = new Set([
  "Reuters",
  "CNBC",
  "Yahoo Finance",
  "Bloomberg.com",
  "MarketWatch",
  "Barron's",
  "CoinDesk",
  "The Block",
  "Investopedia",
  "Financial Times",
  "The Wall Street Journal",
  "Fortune",
  "Business Insider",
  "Nasdaq",
]);
const financeTerms =
  /\b(stock|stocks|market|shares|earnings|investor|bitcoin|crypto|ethereum|ETF|bond|treasur|interest rate|federal reserve|fed\b|inflation|oil|gold|bank|finance|nasdaq|s&p|dow|IPO|acquisition)\b/i;
const lowValueTerms =
  /\b(earnings call|buy now|sell now|best stocks?|top stocks?|double down|double a position|without (any )?hesitation|could soar|millionaire|secret stock|strong buy)\b/i;
const feedItems = (
  await Promise.all(feedResponses.map(async (response) => parseFeed(await response.text())))
)
  .flat()
  .filter((item) => trustedSources.has(item.source) && financeTerms.test(item.title))
  .filter((item) => !lowValueTerms.test(item.title))
  .filter((item, index, rows) => rows.findIndex((row) => row.title === item.title) === index)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
const cryptoItems = feedItems
  .filter((item) => /\b(bitcoin|crypto|ethereum|blockchain|stablecoin)\b/i.test(item.title))
  .slice(0, 3);
const stockItems = feedItems
  .filter((item) => /\b(stock|stocks|shares|earnings|ETF|Nasdaq|S&P|Dow|IPO|acquisition)\b/i.test(item.title))
  .filter((item) => !cryptoItems.some((selected) => selected.id === item.id))
  .slice(0, 5);
const macroItems = feedItems
  .filter((item) => ![...cryptoItems, ...stockItems].some((selected) => selected.id === item.id))
  .slice(0, 4);
const selectedIds = new Set([...cryptoItems, ...stockItems, ...macroItems].map((item) => item.id));
const selectedItems = [...cryptoItems, ...stockItems, ...macroItems];
selectedItems.push(
  ...feedItems.filter((item) => !selectedIds.has(item.id)).slice(0, 12 - selectedItems.length),
);
const items = selectedItems
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  .slice(0, 12);
if (items.length < 3) throw new Error("Global news feed returned too few usable stories");

let previous = { articles: [] };
try {
  previous = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
} catch {}
const previousById = new Map(previous.articles.map((item) => [item.id, item]));
const newItems = items.filter((item) => !previousById.has(item.id));
const translated = newItems.length ? await translate(newItems) : new Map();

const refreshedArticles = items
  .map((item) => {
    const existing = previousById.get(item.id);
    const translation = translated.get(item.id);
    if (existing) return { ...existing, publishedAt: item.publishedAt };
    if (!translation?.titleKa || !translation?.summaryKa) return null;
    return {
      ...item,
      titleKa: decode(translation.titleKa),
      summaryKa: decode(translation.summaryKa),
      category: decode(translation.category || "ბაზრები"),
      translationNotice: "AI-assisted Georgian translation",
    };
  })
  .filter(Boolean);

if (refreshedArticles.length < 3) {
  throw new Error(
    `Translation produced too few usable stories; input=${items.length}, new=${newItems.length}, translated=${translated.size}, ids=${[...translated.keys()].join(",")}`,
  );
}
const articlesById = new Map(
  [...previous.articles, ...refreshedArticles].map((article) => [article.id, article]),
);
const articles = [...articlesById.values()].sort(
  (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
);
const unchanged = JSON.stringify(previous.articles) === JSON.stringify(articles);
if (unchanged) {
  console.log("No new global stories");
} else {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        source: "Google News RSS metadata and original publishers",
        methodology:
          "Headlines are translated into Georgian and summarized from headline facts only. Full articles are not copied.",
        articles,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Published ${articles.length} global stories`);
}
