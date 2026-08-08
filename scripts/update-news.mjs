import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { normalizeNewsCategory } from "../src/content-policy.mjs";
import decoderPackage from "google-news-url-decoder";
import { Agent } from "undici";
import {
  georgianSummary,
  isEligibleGeorgianStory,
  normalizeGeorgianSource,
} from "./georgia-news-policy.mjs";

const { GoogleDecoder } = decoderPackage;

const feedQueries = [
  "(stocks OR earnings OR ETF OR Nasdaq OR \"S&P 500\") when:1d",
  "(artificial intelligence OR AI OR technology OR chips OR semiconductors OR cloud) when:1d",
  "(bitcoin OR ethereum OR crypto) when:1d",
  "(\"Federal Reserve\" OR inflation OR oil OR gold OR bonds) when:1d",
];
const PRIMARY_FEEDS = feedQueries.map(
  (q) =>
    ({
      url: `https://news.google.com/rss/search?${new URLSearchParams({
        q,
        hl: "en-US",
        gl: "US",
        ceid: "US:en",
      })}`,
      source: "Google News",
    }),
);
const FALLBACK_FEEDS = [
  {
    url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EIXIC,BTC-USD,CL%3DF&region=US&lang=en-US",
    source: "Yahoo Finance",
  },
  {
    url: "https://www.nasdaq.com/feed/rssoutbound?category=Markets",
    source: "Nasdaq",
  },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    source: "MarketWatch",
  },
];
const georgianQuery = '("ინვესტიციები" OR "ობლიგაციები" OR "ფასიანი ქაღალდები") when:90d';
const GEORGIAN_FEEDS = ["bm.ge", "entrepreneur.com/ka"].map((domain) => ({
  url: `https://news.google.com/rss/search?${new URLSearchParams({
    q: `site:${domain} ${georgianQuery}`,
    hl: "ka",
    gl: "GE",
    ceid: "GE:ka",
  })}`,
  source: domain === "bm.ge" ? "BM.GE" : "Entrepreneur.ge",
}));
GEORGIAN_FEEDS.push({
  url: "https://www.marketer.ge/feed/",
  source: "Marketer.ge",
});
const BM_TAG_URLS = [
  "https://bm.ge/tag/investitsiebi",
  "https://bm.ge/tag/obligatsiebi",
  "https://bm.ge/tag/fasiani-qaghaldebi",
];
const OUTPUT_PATH = new URL("../data/global-news.json", import.meta.url);
const token = process.env.GITHUB_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const FEED_MAX_ATTEMPTS = 4;
const FEED_TIMEOUT_MS = 12_000;
const ARTICLE_TIMEOUT_MS = 15_000;
const ARTICLE_ENRICH_LIMIT = 2;
const requestedBackfillId = process.env.ARTICLE_BACKFILL_ID?.trim();
const georgiaOnly = process.env.GEORGIA_ONLY === "true";
const publisherAgent = new Agent({ maxHeaderSize: 128 * 1024 });

if (!token) throw new Error("GITHUB_TOKEN is required for Georgian translation");

function decode(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  return decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]);
}

function parseFeed(xml, defaultSource) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const combinedTitle = tag(match[1], "title");
      const separator = combinedTitle.lastIndexOf(" - ");
      const title = separator > 0 ? combinedTitle.slice(0, separator) : combinedTitle;
      const source = separator > 0 ? combinedTitle.slice(separator + 3) : defaultSource;
      const url = tag(match[1], "link");
      const publishedAt = new Date(tag(match[1], "pubDate")).toISOString();
      return {
        id: createHash("sha256").update(url).digest("hex").slice(0, 16),
        title,
        source,
        url,
        publishedAt,
        description: tag(match[1], "description"),
      };
    })
    .filter((item) => item.title && item.url.startsWith("https://"))
    .filter((item, index, rows) => rows.findIndex((row) => row.title === item.title) === index);
}

const translationPrompt = (items) =>
  JSON.stringify({
    task:
      "Translate each financial-news headline faithfully into natural, publication-quality Georgian. Preserve company names, ticker symbols, numbers, percentages, currencies, and quoted claims exactly. Write one concise Georgian explanatory sentence using only facts explicitly present in the English headline. Do not add causes, forecasts, advice, or facts. Classify each article using one allowed Georgian category.",
    articles: items.map(({ id, title, source }) => ({ id, title, source })),
  });

const translationSchema = {
  type: "object",
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          titleKa: { type: "string" },
          summaryKa: { type: "string" },
          category: {
            type: "string",
            enum: ["ტექნოლოგიები", "AI", "ბაზრები და ეკონომიკა", "კრიპტო"],
          },
        },
        required: ["id", "titleKa", "summaryKa", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["articles"],
  additionalProperties: false,
};

async function translateWithGemini(items) {
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");
  const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  let lastError;
  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: translationPrompt(items) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: translationSchema,
        },
      }),
        },
      );
      if (response.ok) {
        const payload = await response.json();
        const text =
          payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
        const parsed = JSON.parse(text);
        const translated = new Map((parsed.articles ?? []).map((item) => [item.id, item]));
        console.log(`Gemini model ${model} translated ${translated.size} stories`);
        return translated;
      }
      const details = (await response.text()).slice(0, 300);
      lastError = new Error(`Gemini ${model} returned ${response.status}: ${details}`);
      if (![429, 503].includes(response.status)) break;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw lastError ?? new Error("Gemini translation failed");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchFeed(feed, feedNumber) {
  let lastStatus = "network error";
  for (let attempt = 1; attempt <= FEED_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(feed.url, {
        headers: {
          accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; Investors.ge financial news monitor/1.0)",
        },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (response.ok) {
        const items = parseFeed(await response.text(), feed.source);
        console.log(`Feed ${feedNumber} returned ${items.length} stories on attempt ${attempt}`);
        return items;
      }
      lastStatus = `HTTP ${response.status}`;
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastStatus = error.name === "TimeoutError" ? "timeout" : error.message;
    }
    if (attempt < FEED_MAX_ATTEMPTS) {
      const delay = attempt * 2_000 + Math.floor(Math.random() * 1_000);
      console.warn(
        `Feed ${feedNumber} failed with ${lastStatus}; retrying in ${delay}ms (${attempt}/${FEED_MAX_ATTEMPTS})`,
      );
      await wait(delay);
    }
  }
  throw new Error(`Feed ${feedNumber} failed after ${FEED_MAX_ATTEMPTS} attempts: ${lastStatus}`);
}

async function fetchBmTag(tagUrl) {
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(tagUrl, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; Investors.ge Georgian news monitor/1.0)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) break;
      lastError = new Error(`BM.GE tag returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await wait(attempt * 2_000);
  }
  if (!response?.ok) throw lastError || new Error("BM.GE tag unavailable");
  const html = await response.text();
  const candidates = [...html.matchAll(/<a[^>]+href="(https:\/\/bm\.ge\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: decode(match[1]), title: decode(match[2]) }))
    .filter((item) => item.title && isEligibleGeorgianStory({ ...item, source: "BM.GE" }))
    .filter((item, index, rows) => rows.findIndex((row) => row.url === item.url) === index)
    .slice(0, 10);
  return Promise.all(candidates.map(async (candidate) => {
    try {
      const articleResponse = await fetch(candidate.url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; Investors.ge Georgian news monitor/1.0)" },
        signal: AbortSignal.timeout(10_000),
      });
      const articleHtml = articleResponse.ok ? await articleResponse.text() : "";
      const published = articleHtml.match(/article:published_time["'][^>]*content=["']([^"']+)/i)?.[1]
        || articleHtml.match(/["']datePublished["']\s*:\s*["']([^"']+)/i)?.[1];
      const description = articleHtml.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i)?.[1] || candidate.title;
      return {
        id: createHash("sha256").update(candidate.url).digest("hex").slice(0, 16),
        title: candidate.title,
        description: decode(description),
        source: "BM.GE",
        url: candidate.url,
        publishedAt: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : "",
        dateVerified: Boolean(published && !Number.isNaN(Date.parse(published))),
      };
    } catch {
      return {
        id: createHash("sha256").update(candidate.url).digest("hex").slice(0, 16),
        title: candidate.title,
        description: candidate.title,
        source: "BM.GE",
        url: candidate.url,
        publishedAt: "",
        dateVerified: false,
      };
    }
  }));
}

async function translateWithGithub(items) {
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
                  category: "one of: ტექნოლოგიები, AI, ბაზრები და ეკონომიკა, კრიპტო",
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

async function translate(items) {
  try {
    const translated = await translateWithGemini(items);
    return translated;
  } catch (error) {
    console.warn(`Gemini translation failed; using GitHub Models fallback: ${error.message}`);
    return translateWithGithub(items);
  }
}

async function collectFeeds(feeds, label) {
  const results = await Promise.allSettled(
    feeds.map((feed, index) => fetchFeed(feed, `${label} ${index + 1}`)),
  );
  const successful = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const failed = results.filter((result) => result.status === "rejected");
  failed.forEach((result) => console.warn(result.reason.message));
  return { successful, failed };
}

function findArticleBody(value) {
  if (!value) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findArticleBody(item);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  if (typeof value.articleBody === "string") return value.articleBody;
  for (const item of Object.values(value)) {
    const found = findArticleBody(item);
    if (found) return found;
  }
  return "";
}

function extractArticleText(html) {
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const body = findArticleBody(JSON.parse(match[1]));
      if (body.length >= 500) return decode(body).slice(0, 18_000);
    } catch {}
  }
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decode(match[1]))
    .filter((paragraph) => paragraph.length >= 70)
    .filter(
      (paragraph) =>
        !/cookie|privacy policy|sign up|subscribe|advertisement|all rights reserved/i.test(
          paragraph,
        ),
    );
  return [...new Set(paragraphs)].join("\n\n").slice(0, 18_000);
}

async function resolveSourceArticle(article) {
  let sourceUrl = article.sourceUrl || article.url;
  if (/^https:\/\/news\.google\.com\//i.test(sourceUrl)) {
    const decoder = new GoogleDecoder();
    const result = await decoder.decode(sourceUrl);
    if (!result.status || !/^https:\/\//i.test(result.decoded_url || "")) {
      throw new Error(result.message || "Google News URL could not be resolved");
    }
    sourceUrl = result.decoded_url;
  }
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (compatible; Investors.ge newsroom/1.0)",
    },
    signal: AbortSignal.timeout(ARTICLE_TIMEOUT_MS),
    dispatcher: publisherAgent,
  });
  if (!response.ok) throw new Error(`Publisher returned HTTP ${response.status}`);
  const sourceText = extractArticleText(await response.text());
  if (sourceText.length < 500) {
    throw new Error(`Publisher supplied too little extractable text (${sourceText.length} chars)`);
  }
  return { sourceUrl: response.url || sourceUrl, sourceText };
}

async function writeOriginalGeorgianArticle(article, sourceText) {
  const schema = {
    type: "object",
    properties: {
      bodyKa: { type: "string" },
    },
    required: ["bodyKa"],
    additionalProperties: false,
  };
  const prompt = JSON.stringify({
    role: "Investors.ge Georgian financial journalist",
    task:
      "Write an original Georgian-language financial news article based only on the supplied source facts. This is not a translation and must not reproduce the source article sentence by sentence.",
    requirements: [
      "Write 350-650 Georgian words.",
      "Begin directly with the most important verified fact.",
      "Use 3-5 useful Georgian section headings formatted as ## Heading.",
      "Use short readable paragraphs separated by blank lines.",
      "Preserve all company names, ticker symbols, numbers, dates, percentages, and currencies exactly.",
      "Distinguish portfolio weight, dividend yield, expense ratio, return, drawdown, assets under management, and trading volume. Never relabel one metric as another.",
      "Cross-check every number against the exact SOURCE_TEXT sentence before returning the article.",
      "Explain specialist terms briefly for a Georgian reader.",
      "Do not add facts, prices, performance figures, causes, forecasts, quotations, or recommendations absent from SOURCE_TEXT.",
      "Do not tell the reader to buy or sell.",
      "Do not mention that an AI wrote the article.",
      "Paraphrase independently; do not copy long phrases from SOURCE_TEXT.",
      "If the source does not support 350 words, write a shorter factual article instead of padding or inventing.",
    ],
    headlineKa: article.titleKa,
    shortSummaryKa: article.summaryKa,
    originalHeadline: article.title,
    publisher: article.source,
    SOURCE_TEXT: sourceText,
  });
  const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  let lastError;
  for (const model of geminiApiKey ? models : []) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": geminiApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.15,
              maxOutputTokens: 3000,
              responseMimeType: "application/json",
              responseJsonSchema: schema,
            },
          }),
        },
      );
      if (response.ok) {
        const payload = await response.json();
        const text =
          payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
        const bodyKa = JSON.parse(text).bodyKa?.trim();
        if (!bodyKa || bodyKa.length < 600) {
          throw new Error(`Gemini returned an article that is too short (${bodyKa?.length || 0})`);
        }
        return bodyKa;
      }
      lastError = new Error(
        `Gemini ${model} returned ${response.status}: ${(await response.text()).slice(0, 250)}`,
      );
      if (![429, 503].includes(response.status)) break;
      if (attempt < 3) await wait(attempt * 2_000);
    }
  }
  console.warn(
    `Gemini article generation failed; using GitHub Models fallback: ${
      lastError?.message || "GEMINI_API_KEY is not configured"
    }`,
  );
  const githubResponse = await fetch(
    "https://models.github.ai/inference/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.15,
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a careful Georgian financial journalist. Return valid JSON only with one bodyKa string. Use only supplied source facts, never invent information or investment advice, and write an original overview rather than a translation.",
          },
          { role: "user", content: prompt },
        ],
      }),
    },
  );
  if (!githubResponse.ok) {
    throw new Error(`GitHub Models returned ${githubResponse.status}`);
  }
  const payload = await githubResponse.json();
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
  const bodyKa = parsed.bodyKa?.trim();
  if (!bodyKa || bodyKa.length < 600) {
    throw new Error(`GitHub Models returned an article that is too short (${bodyKa?.length || 0})`);
  }
  return bodyKa;
}

async function auditOriginalGeorgianArticle(article, sourceText, draftBodyKa) {
  const response = await fetch(
    "https://models.github.ai/inference/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are the factual copy editor for a Georgian financial publication. Return valid JSON only with one correctedBodyKa string. Compare every claim and number in the Georgian draft against SOURCE_TEXT. Correct or remove anything unsupported. Pay special attention to the difference between portfolio weight, yield, expense ratio, return, drawdown, assets under management, and trading volume. Preserve Georgian ## headings and never add investment advice.",
          },
          {
            role: "user",
            content: JSON.stringify({
              headline: article.title,
              publisher: article.source,
              SOURCE_TEXT: sourceText,
              GEORGIAN_DRAFT: draftBodyKa,
            }),
          },
        ],
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Article factual audit returned ${response.status}`);
  }
  const payload = await response.json();
  const correctedBodyKa = JSON.parse(
    payload.choices?.[0]?.message?.content ?? "{}",
  ).correctedBodyKa?.trim();
  if (!correctedBodyKa || correctedBodyKa.length < 600) {
    throw new Error(
      `Article factual audit returned invalid content (${correctedBodyKa?.length || 0})`,
    );
  }
  return correctedBodyKa;
}

async function enrichArticle(article) {
  const { sourceUrl, sourceText } = await resolveSourceArticle(article);
  const draftBodyKa = await writeOriginalGeorgianArticle(article, sourceText);
  const bodyKa = await auditOriginalGeorgianArticle(article, sourceText, draftBodyKa);
  return {
    ...article,
    sourceUrl,
    bodyKa,
    articleNotice: "Original Georgian overview based on the credited publisher source",
  };
}

let { successful: successfulFeeds, failed: failedFeeds } = await collectFeeds(
  PRIMARY_FEEDS,
  "primary",
);
if (!successfulFeeds.length) {
  console.warn("All primary feeds failed; switching to independent publisher feeds");
  ({ successful: successfulFeeds, failed: failedFeeds } = await collectFeeds(
    FALLBACK_FEEDS,
    "fallback",
  ));
}
if (!successfulFeeds.length) {
  throw new Error("All primary and fallback global news feeds failed after retries");
}
if (failedFeeds.length) {
  console.warn(
    `Continuing with ${successfulFeeds.length} healthy global news feeds`,
  );
}
const { successful: healthyGeorgianFeeds, failed: failedGeorgianFeeds } = await collectFeeds(
  GEORGIAN_FEEDS,
  "Georgia",
);
if (failedGeorgianFeeds.length) {
  console.warn(`Continuing with ${healthyGeorgianFeeds.length} healthy Georgian publisher feeds`);
}
const bmTagResults = await Promise.allSettled(BM_TAG_URLS.map(fetchBmTag));
const bmTagItems = bmTagResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
const georgianItems = [...healthyGeorgianFeeds.flat(), ...bmTagItems]
  .map((item) => ({ ...item, source: normalizeGeorgianSource(item.source, item.url) }))
  .filter(isEligibleGeorgianStory)
  .filter((item, index, rows) => rows.findIndex((row) => row.title === item.title) === index)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  .slice(0, 18);
const trustedSources = new Set([
  "Yahoo Finance",
  "Google Finance",
  "Nasdaq",
  "Bloomberg",
  "Bloomberg.com",
  "MarketWatch",
]);
const financeTerms =
  /\b(stock|stocks|market|shares|earnings|investor|bitcoin|crypto|ethereum|ETF|bond|treasur|interest rate|federal reserve|fed\b|inflation|oil|gold|bank|finance|nasdaq|s&p|dow|IPO|acquisition|technology|artificial intelligence|AI|chip|semiconductor|cloud|software)\b/i;
const lowValueTerms =
  /\b(earnings call|buy now|sell now|best stocks?|top stocks?|double down|double a position|without (any )?hesitation|could soar|millionaire|secret stock|strong buy)\b/i;
const conflictNewsTerms =
  /\b(ukraine|ukrainian|russia|russian|gaza|hamas|hezbollah|drone strike|airstrike|air strike|missile attack|military attack|battlefield|invasion|bombing|troop deployment|war in ukraine|israel.{0,20}(war|attack|strike)|iran.{0,20}(war|attack|strike|missile))\b/i;
const feedItems = successfulFeeds
  .flat()
  .filter((item) => trustedSources.has(item.source) && financeTerms.test(item.title))
  .filter((item) => !lowValueTerms.test(item.title))
  .filter((item) => !conflictNewsTerms.test(item.title))
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
const items = (georgiaOnly ? [] : selectedItems)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  .slice(0, 12);
if (!georgiaOnly && items.length < 3) throw new Error("Global news feed returned too few usable stories");

if (process.env.GEMINI_SMOKE_TEST === "true") {
  const smokeTest = await translateWithGemini(items.slice(0, 2));
  if (smokeTest.size !== 2) throw new Error(`Gemini smoke test returned ${smokeTest.size}/2 stories`);
  console.log("Gemini smoke test translated 2/2 stories successfully");
  process.exit(0);
}

let previous = { articles: [] };
try {
  previous = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
} catch {}
const previousById = new Map(previous.articles.map((item) => [item.id, item]));
const newItems = items.filter((item) => !previousById.has(item.id));
const newGeorgianItems = georgianItems.filter((item) => !previousById.has(item.id));
let translated = new Map();
if (newItems.length && !requestedBackfillId) {
  try {
    translated = await translate(newItems);
  } catch (error) {
    console.warn(
      `New headline translation is temporarily unavailable; preserving the current archive: ${error.message}`,
    );
  }
}

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
      category: normalizeNewsCategory(
        decode(translation.category || "ბაზრები და ეკონომიკა"),
        `${item.title || ""} ${translation.titleKa || ""} ${translation.summaryKa || ""}`,
      ),
      translationNotice: "AI-assisted Georgian translation",
    };
  })
  .filter(Boolean);
const refreshedGeorgianArticles = georgianItems.map((item) => {
  const existing = previousById.get(item.id);
  if (existing) return {
    ...existing,
    ...(item.dateVerified ? { publishedAt: item.publishedAt } : {}),
    description: decode(item.description || existing.description || ""),
    summaryKa: decode(georgianSummary(item)),
  };
  return {
    id: item.id,
    title: item.title,
    source: item.source,
    url: item.url,
    publishedAt: item.publishedAt || new Date().toISOString(),
    description: item.description,
    titleKa: decode(item.title),
    summaryKa: decode(georgianSummary(item)),
    category: "საქართველო",
    translationNotice: "",
  };
});

if (!georgiaOnly && refreshedArticles.length < 3 && previous.articles.length < 3) {
  throw new Error(
    `Translation produced too few usable stories; input=${items.length}, new=${newItems.length}, translated=${translated.size}, ids=${[...translated.keys()].join(",")}`,
  );
}
const articlesById = new Map(
  [...previous.articles, ...refreshedArticles, ...refreshedGeorgianArticles].map((article) => [article.id, article]),
);
let articles = [...articlesById.values()].sort(
  (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
);
const enrichmentCandidates = [];
const queuedIds = new Set();
const queueForEnrichment = (article, force = false) => {
  if (!article || queuedIds.has(article.id) || (!force && article.bodyKa)) return;
  queuedIds.add(article.id);
  enrichmentCandidates.push(article);
};
if (requestedBackfillId) {
  queueForEnrichment(
    articles.find((article) => article.id === requestedBackfillId),
    true,
  );
}
if (!georgiaOnly && refreshedArticles.length < 3) {
  console.warn("No newly translated global batch; preserving the existing archive and continuing with Georgian publisher updates");
}
newGeorgianItems.forEach((item) =>
  queueForEnrichment(articles.find((article) => article.id === item.id)),
);
newItems.forEach((item) =>
  queueForEnrichment(articles.find((article) => article.id === item.id)),
);
articles.forEach((article) => queueForEnrichment(article));

const enrichedById = new Map();
for (const article of enrichmentCandidates.slice(0, ARTICLE_ENRICH_LIMIT)) {
  try {
    console.log(`Building original Georgian article for ${article.id} (${article.source})`);
    enrichedById.set(article.id, await enrichArticle(article));
  } catch (error) {
    console.warn(`Article enrichment failed for ${article.id}: ${error.message}`);
    if (article.id === requestedBackfillId) throw error;
  }
}
if (requestedBackfillId && !queuedIds.has(requestedBackfillId)) {
  throw new Error(`Requested backfill article was not found: ${requestedBackfillId}`);
}
articles = articles.map((article) => enrichedById.get(article.id) || article);

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
          "Headlines and short summaries are translated into Georgian. Expanded stories are original Georgian overviews written from extracted publisher facts; source articles are credited and not reproduced.",
        articles,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Published ${articles.length} global stories`);
}
