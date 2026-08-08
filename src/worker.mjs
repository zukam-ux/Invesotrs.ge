import { createHash } from "node:crypto";
import {
  renderNewsArticlePage,
  renderNewsNotFoundPage,
} from "./news-page.mjs";
import { normalizeNewsCategory } from "./content-policy.mjs";

const NEWS_FEEDS = [
  {
    url: "https://finance.yahoo.com/news/rssindex",
    source: "Yahoo Finance",
  },
  {
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    source: "CNBC",
  },
  {
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    source: "CoinDesk",
  },
];
const CRYPTO_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&price_change_percentage=24h&sparkline=true";
const NBG_URL =
  "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/json/";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const MARKET_SERIES_RANGES = {
  "1d": { range: "1d", interval: "5m", label: "ბოლო 1 დღე" },
  "1w": { range: "5d", interval: "30m", label: "ბოლო 1 კვირა" },
  "1m": { range: "1mo", interval: "1d", label: "ბოლო 1 თვე" },
  "3m": { range: "3mo", interval: "1d", label: "ბოლო 3 თვე" },
  "1y": { range: "1y", interval: "1d", label: "ბოლო 1 წელი" },
};
const trustedSources = new Set([
  "Yahoo Finance",
  "Google Finance",
  "Nasdaq",
  "Bloomberg",
  "Bloomberg.com",
  "MarketWatch",
  "National Bank of Georgia",
  "Georgian Stock Exchange",
  "Ministry of Finance of Georgia",
  "GeoStat",
  "BM.GE",
  "Entrepreneur.ge",
  "Marketer.ge",
]);
const financeTerms =
  /\b(stock|stocks|market|shares|earnings|investor|bitcoin|crypto|ethereum|ETF|bond|treasur|interest rate|federal reserve|fed\b|inflation|oil|gold|bank|finance|nasdaq|s&p|dow|IPO|acquisition|technology|artificial intelligence|AI|chip|semiconductor|cloud|software)\b/i;
const lowValueTerms =
  /\b(earnings call|buy now|sell now|best stocks?|top stocks?|double down|double a position|without (any )?hesitation|could soar|millionaire|secret stock|strong buy)\b/i;
const conflictNewsTerms =
  /\b(ukraine|ukrainian|russia|russian|gaza|hamas|hezbollah|drone strike|airstrike|air strike|missile attack|military attack|battlefield|invasion|bombing|troop deployment|war in ukraine|israel.{0,20}(war|attack|strike)|iran.{0,20}(war|attack|strike|missile))\b/i;

function json(payload, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(payload), { ...options, headers });
}

async function fetchJson(url, timeoutMs = 7000, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", ...headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

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
  return decode(
    block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1],
  );
}

function parseFeed(xml, fixedSource = "") {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const combinedTitle = tag(match[1], "title");
      const separator = combinedTitle.lastIndexOf(" - ");
      const title =
        separator > 0 ? combinedTitle.slice(0, separator) : combinedTitle;
      const source =
        fixedSource ||
        (separator > 0 ? combinedTitle.slice(separator + 3) : "Global news");
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
    .filter(
      (item, index, rows) =>
        rows.findIndex((row) => row.title === item.title) === index,
    );
}

function selectStories(feedItems) {
  const cryptoItems = feedItems
    .filter((item) =>
      /\b(bitcoin|crypto|ethereum|blockchain|stablecoin)\b/i.test(item.title),
    )
    .slice(0, 3);
  const stockItems = feedItems
    .filter((item) =>
      /\b(stock|stocks|shares|earnings|ETF|Nasdaq|S&P|Dow|IPO|acquisition)\b/i.test(
        item.title,
      ),
    )
    .filter((item) => !cryptoItems.some((selected) => selected.id === item.id))
    .slice(0, 5);
  const macroItems = feedItems
    .filter(
      (item) =>
        ![...cryptoItems, ...stockItems].some(
          (selected) => selected.id === item.id,
        ),
    )
    .slice(0, 4);
  const selectedIds = new Set(
    [...cryptoItems, ...stockItems, ...macroItems].map((item) => item.id),
  );
  const selectedItems = [...cryptoItems, ...stockItems, ...macroItems];
  selectedItems.push(
    ...feedItems
      .filter((item) => !selectedIds.has(item.id))
      .slice(0, 12 - selectedItems.length),
  );
  return selectedItems
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 6);
}

async function translateStories(items, env) {
  if (!items.length) return [];
  return Promise.all(
    items.map(async (item) => {
      const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        temperature: 0.1,
        max_tokens: 180,
        prompt:
          `Translate this financial headline faithfully into fluent Georgian. ` +
          `Preserve company names, tickers, numbers, currencies, and Bitcoin exactly. ` +
          `Output only the Georgian headline, with no label or explanation:\n${item.title}`,
      });
      const titleKa = decode(response.response || "")
        .replace(/^["']|["']$/g, "")
        .trim();
      const category = /\b(bitcoin|crypto|ethereum|blockchain|stablecoin)\b/i.test(
        item.title,
      )
        ? "კრიპტო"
        : /\bETF\b/i.test(item.title)
          ? "ETF"
          : /\b(stock|stocks|shares|earnings|Nasdaq|S&P|Dow|IPO)\b/i.test(
                item.title,
              )
            ? "აქციები"
            : "ეკონომიკა";
      return {
        id: item.id,
        titleKa,
        summaryKa: titleKa ? `${titleKa}.` : "",
        category,
      };
    }),
  );
  /*
  const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
    temperature: 0.1,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a careful Georgian financial news editor. Translate headlines faithfully into natural Georgian. Write one concise Georgian explanatory sentence using only facts explicitly present in the supplied English headline. Never invent numbers, causes, forecasts, quotes, or investment advice. Return valid JSON only with an articles array.",
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
                category:
                  "აქციები | კრიპტო | ETF | ეკონომიკა | კომპანიები",
              },
            ],
          },
          articles: items.map(({ id, title, source }) => ({
            id,
            title,
            source,
          })),
        }),
      },
    ],
  });
  const raw = response.response ?? response.result?.response ?? "";
  const parsed =
    typeof raw === "string"
      ? JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}")
      : raw;
  return parsed.articles ?? parsed.requiredShape?.articles ?? [];
  */
}

async function updateNews(env) {
  const feedResponses = await Promise.all(
    NEWS_FEEDS.map(async (feed) => ({
      feed,
      response: await fetch(feed.url, {
        headers: {
          accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent":
            "Mozilla/5.0 (compatible; Investors.ge/2.0; +https://investors.ge)",
        },
      }),
    })),
  );
  const usableResponses = feedResponses.filter(({ response }) => response.ok);
  if (!usableResponses.length) throw new Error("All news feeds failed");
  const feedItems = (
    await Promise.all(
      usableResponses.map(async ({ feed, response }) =>
        parseFeed(await response.text(), feed.source),
      ),
    )
  )
    .flat()
    .filter(
      (item) => trustedSources.has(item.source) && financeTerms.test(item.title),
    )
    .filter((item) => !lowValueTerms.test(item.title))
    .filter(
      (item, index, rows) =>
        rows.findIndex((row) => row.title === item.title) === index,
    )
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const selected = selectStories(feedItems);
  if (selected.length < 3) throw new Error("Too few usable feed stories");

  const placeholders = selected.map(() => "?").join(",");
  const existing = await env.DB.prepare(
    `SELECT id FROM articles WHERE id IN (${placeholders})`,
  )
    .bind(...selected.map((item) => item.id))
    .all();
  const existingIds = new Set(existing.results.map((row) => row.id));
  const newItems = selected
    .filter((item) => !existingIds.has(item.id))
    .slice(0, 1);
  const translations = await translateStories(newItems, env);
  const translationsById = new Map(
    translations.map((translation) => [translation.id, translation]),
  );
  const insertable = newItems
    .map((item) => ({ ...item, translation: translationsById.get(item.id) }))
    .filter(
      (item) => item.translation?.titleKa && item.translation?.summaryKa,
    );

  if (insertable.length) {
    await env.DB.batch(
      insertable.map((item) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO articles
          (id, title, title_ka, summary_ka, source, url, published_at, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          item.id,
          item.title,
          decode(item.translation.titleKa),
          decode(item.translation.summaryKa),
          item.source,
          item.url,
          item.publishedAt,
          decode(item.translation.category || "ბაზრები"),
        ),
      ),
    );
  }
  return { selected: selected.length, inserted: insertable.length };
}

async function syncPublishedNews(env) {
  const response = await fetch(
    "https://raw.githubusercontent.com/zukam-ux/Invesotrs.ge/main/data/global-news.json",
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(`Published news archive returned ${response.status}`);
  }
  const payload = await response.json();
  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  if (!articles.length) throw new Error("Published news archive is empty");
  await env.DB.batch(
    articles.map((article) =>
      env.DB.prepare(
        `INSERT INTO articles
        (id, title, title_ka, summary_ka, source, url, published_at, category, body_ka, source_url, editorial_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'საქართველო' THEN 'pending' ELSE 'published' END)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          title_ka = excluded.title_ka,
          summary_ka = excluded.summary_ka,
          source = excluded.source,
          url = excluded.url,
          published_at = excluded.published_at,
          category = excluded.category,
          body_ka = COALESCE(
            CASE WHEN excluded.body_ka IS NULL OR LOWER(TRIM(excluded.body_ka)) IN ('', 'null', 'undefined') THEN NULL ELSE excluded.body_ka END,
            CASE WHEN articles.body_ka IS NULL OR LOWER(TRIM(articles.body_ka)) IN ('', 'null', 'undefined') THEN NULL ELSE articles.body_ka END
          ),
          source_url = COALESCE(excluded.source_url, articles.source_url)`,
      ).bind(
        article.id,
        article.title,
        article.titleKa,
        article.summaryKa,
        article.source,
        article.url,
        article.publishedAt,
        article.category || "ბაზრები",
        article.bodyKa || null,
        article.sourceUrl || null,
        normalizeNewsCategory(article.category, `${article.title || ""} ${article.titleKa || ""}`),
      ),
    ),
  );
  return { imported: articles.length };
}

async function ingestNews(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (
    !env.NEWS_INGEST_TOKEN ||
    authorization !== `Bearer ${env.NEWS_INGEST_TOKEN}`
  ) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await request.json();
  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  if (!articles.length) {
    return json({ error: "No articles supplied" }, { status: 400 });
  }
  await env.DB.batch(
    articles.map((article) =>
      env.DB.prepare(
        `INSERT INTO articles
        (id, title, title_ka, summary_ka, source, url, published_at, category, body_ka, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          title_ka = excluded.title_ka,
          summary_ka = excluded.summary_ka,
          source = excluded.source,
          url = excluded.url,
          published_at = excluded.published_at,
          category = excluded.category,
          body_ka = COALESCE(
            CASE WHEN excluded.body_ka IS NULL OR LOWER(TRIM(excluded.body_ka)) IN ('', 'null', 'undefined') THEN NULL ELSE excluded.body_ka END,
            CASE WHEN articles.body_ka IS NULL OR LOWER(TRIM(articles.body_ka)) IN ('', 'null', 'undefined') THEN NULL ELSE articles.body_ka END
          ),
          source_url = COALESCE(excluded.source_url, articles.source_url)`,
      ).bind(
        article.id,
        article.title,
        article.titleKa,
        article.summaryKa,
        article.source,
        article.url,
        article.publishedAt,
        article.category || "ბაზრები",
        article.bodyKa || null,
        article.sourceUrl || null,
      ),
    ),
  );
  return json({ imported: articles.length });
}

function isEditoriallyPublishedSql() {
  return `(category != 'საქართველო' OR (
    editorial_status = 'published' AND (
      title LIKE '%ბირჟაზე%' OR title_ka LIKE '%ბირჟაზე%' OR
      title LIKE '%ბაზარი%' OR title_ka LIKE '%ბაზარი%' OR
      title LIKE '%ინვესტიციები%' OR title_ka LIKE '%ინვესტიციები%' OR
      title LIKE '%ინვესტიცია%' OR title_ka LIKE '%ინვესტიცია%' OR
      title LIKE '%ობლიგაციები%' OR title_ka LIKE '%ობლიგაციები%'
    )
  ))`;
}

function hasEditorialAuthorization(request, env) {
  const authorization = request.headers.get("authorization") || "";
  return Boolean(
    env.EDITORIAL_REVIEW_TOKEN && authorization === `Bearer ${env.EDITORIAL_REVIEW_TOKEN}`,
  );
}

async function listPendingEditorialReviews(request, env) {
  if (!hasEditorialAuthorization(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const result = await env.DB.prepare(
    `SELECT id, title, title_ka, summary_ka, source, url, source_url, published_at,
            category, editorial_status, revision
     FROM articles
     WHERE category = 'საქართველო' AND editorial_status = 'pending'
     ORDER BY published_at DESC
     LIMIT 100`,
  ).all();
  return json(
    { reviewerRole: "Investors.ge Editor", count: result.results.length, articles: result.results },
    { headers: { "cache-control": "no-store" } },
  );
}

async function reviewGeorgianArticle(request, env) {
  if (!hasEditorialAuthorization(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const payload = await request.json().catch(() => ({}));
  const articleId = String(payload.articleId || "").trim();
  const action = String(payload.action || "").trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/i.test(articleId) || !["approve", "reject"].includes(action)) {
    return json({ error: "Valid articleId and approve/reject action required" }, { status: 400 });
  }
  const article = await env.DB.prepare(
    `SELECT id, category, editorial_status, revision
     FROM articles WHERE id = ? LIMIT 1`,
  ).bind(articleId).first();
  if (!article || normalizeNewsCategory(article.category) !== "საქართველო") {
    return json({ error: "Georgian article not found" }, { status: 404 });
  }
  const editorialStatus = action === "approve" ? "published" : "rejected";
  const auditAction = action === "approve" ? "approved" : "rejected";
  const reviewedAt = new Date().toISOString();
  const nextRevision = Number(article.revision || 1) + 1;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE articles
       SET editorial_status = ?, reviewed_by = 'Investors.ge Editor', reviewed_at = ?, revision = ?
       WHERE id = ?`,
    ).bind(editorialStatus, reviewedAt, nextRevision, articleId),
    env.DB.prepare(
      `INSERT INTO editorial_reviews (article_id, action, reviewer_role, reviewed_at, revision)
       VALUES (?, ?, 'Investors.ge Editor', ?, ?)`,
    ).bind(articleId, auditAction, reviewedAt, nextRevision),
  ]);
  return json(
    { articleId, status: editorialStatus, reviewerRole: "Investors.ge Editor", reviewedAt, revision: nextRevision },
    { headers: { "cache-control": "no-store" } },
  );
}

async function serveNews(env) {
  const result = await env.DB.prepare(
    `SELECT id, title, title_ka, summary_ka, source, url,
            published_at, category, translation_notice
     FROM articles
     WHERE source IN ('Yahoo Finance', 'Google Finance', 'Nasdaq', 'Bloomberg', 'Bloomberg.com', 'MarketWatch', 'National Bank of Georgia', 'Georgian Stock Exchange', 'Ministry of Finance of Georgia', 'GeoStat', 'BM.GE', 'Entrepreneur.ge', 'Marketer.ge')
       AND ${isEditoriallyPublishedSql()}
     ORDER BY published_at DESC LIMIT 2000`,
  ).all();
  const articles = result.results
    .map((row) => ({
      id: row.id,
      title: row.title,
      titleKa: row.title_ka,
      summaryKa: row.summary_ka,
      source: row.source,
      url: row.url,
      publishedAt: row.published_at,
      category: normalizeNewsCategory(
        row.category,
        `${row.title || ""} ${row.title_ka || ""} ${row.summary_ka || ""}`,
      ),
      translationNotice: row.translation_notice,
    }))
    .filter(
      (article) =>
        !conflictNewsTerms.test(
          `${article.title || ""} ${article.titleKa || ""} ${article.summaryKa || ""}`,
        ),
    );
  return json(
    {
      updatedAt: articles[0]?.publishedAt ?? null,
      source: "Google News RSS metadata and original publishers",
      methodology:
        "Headlines and short summaries are translated into Georgian. Expanded stories are original Georgian overviews based on credited publisher facts; source articles are not reproduced.",
      articles,
    },
    {
      headers: {
        "cache-control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

async function serveStatus(env) {
  const checkedAt = new Date();
  try {
    const news = await env.DB.prepare(
      `SELECT COUNT(*) AS article_count, MAX(published_at) AS latest_published_at,
              SUM(CASE WHEN category = 'საქართველო' AND editorial_status = 'pending' THEN 1 ELSE 0 END) AS pending_georgian_count
       FROM articles WHERE ${isEditoriallyPublishedSql()}`,
    ).first();
    const latestPublishedAt = news?.latest_published_at || null;
    const newsAgeMinutes = latestPublishedAt
      ? Math.max(0, Math.round((checkedAt.getTime() - new Date(latestPublishedAt).getTime()) / 60000))
      : null;
    const newsFresh = Number.isFinite(newsAgeMinutes) && newsAgeMinutes <= 240;
    return json(
      {
        status: newsFresh ? "operational" : "degraded",
        checkedAt: checkedAt.toISOString(),
        services: {
          web: { status: "operational" },
          database: { status: "operational" },
          news: {
            status: newsFresh ? "operational" : "stale",
            latestPublishedAt,
            ageMinutes: newsAgeMinutes,
            articleCount: Number(news?.article_count || 0),
            freshnessTargetMinutes: 240,
            pendingGeorgianReviewCount: Number(news?.pending_georgian_count || 0),
          },
        },
      },
      { status: newsFresh ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return json(
      {
        status: "unavailable",
        checkedAt: checkedAt.toISOString(),
        services: { web: { status: "operational" }, database: { status: "unavailable" } },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

async function serveNewsArticle(request, env, articleId) {
  const article = await env.DB.prepare(
    `SELECT id, title, title_ka, summary_ka, body_ka, source, url, source_url,
            published_at, category, translation_notice
     FROM articles
     WHERE id = ?
       AND source IN ('Yahoo Finance', 'Google Finance', 'Nasdaq', 'Bloomberg', 'Bloomberg.com', 'MarketWatch', 'National Bank of Georgia', 'Georgian Stock Exchange', 'Ministry of Finance of Georgia', 'GeoStat', 'BM.GE', 'Entrepreneur.ge', 'Marketer.ge')
       AND ${isEditoriallyPublishedSql()}
     LIMIT 1`,
  )
    .bind(articleId)
    .first();
  const isBlocked =
    !article ||
    conflictNewsTerms.test(
      `${article?.title || ""} ${article?.title_ka || ""} ${article?.summary_ka || ""}`,
    );
  if (isBlocked) {
    return new Response(renderNewsNotFoundPage(request.url), {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60, s-maxage=300",
        "x-content-type-options": "nosniff",
      },
    });
  }
  const related = await env.DB.prepare(
    `SELECT id, title, title_ka, summary_ka, source, url, published_at, category
     FROM articles
     WHERE id != ?
       AND category = ?
       AND source IN ('Yahoo Finance', 'Google Finance', 'Nasdaq', 'Bloomberg', 'Bloomberg.com', 'MarketWatch', 'National Bank of Georgia', 'Georgian Stock Exchange', 'Ministry of Finance of Georgia', 'GeoStat', 'BM.GE', 'Entrepreneur.ge', 'Marketer.ge')
       AND ${isEditoriallyPublishedSql()}
     ORDER BY published_at DESC
     LIMIT 3`,
  )
    .bind(article.id, article.category || "")
    .all();
  return new Response(renderNewsArticlePage(article, related.results, request.url), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "x-content-type-options": "nosniff",
    },
  });
}

async function fetchYahooCrypto(symbol, id) {
  try {
    const payload = await fetchJson(
      `${YAHOO_CHART_URL}${encodeURIComponent(symbol)}?interval=1h&range=7d`,
      7000,
      { "user-agent": "Investors.ge crypto market/2.0" },
    );
    const result = payload.chart?.result?.[0];
    const meta = result?.meta;
    const price = Number(meta?.regularMarketPrice);
    const previousClose = Number(meta?.chartPreviousClose);
    const sparkline = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      Number.isFinite,
    );
    if (!Number.isFinite(price)) return null;
    return [
      id,
      {
        usd: price,
        usd_24h_change:
          Number.isFinite(previousClose) && previousClose
            ? ((price - previousClose) / previousClose) * 100
            : null,
        last_updated_at: meta.regularMarketTime ?? null,
        sparkline,
      },
    ];
  } catch {
    return null;
  }
}

async function serveMarketData() {
  const [cryptoResult, fxResult] = await Promise.allSettled([
    fetchJson(CRYPTO_URL),
    fetchJson(NBG_URL),
  ]);
  const cryptoRows =
    cryptoResult.status === "fulfilled" ? cryptoResult.value : [];
  const fxRows = fxResult.status === "fulfilled" ? fxResult.value : [];
  if (!cryptoRows.length && !fxRows.length) {
    return json(
      {
        error: "MARKET_DATA_UNAVAILABLE",
        message: "Live market data is temporarily unavailable.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const currencies = fxRows?.[0]?.currencies ?? [];
  const byCode = (code) => currencies.find((item) => item.code === code);
  let crypto = Object.fromEntries(
    cryptoRows.map((item) => [
      item.id,
      {
        usd: item.current_price,
        usd_24h_change: item.price_change_percentage_24h,
        last_updated_at: Math.floor(
          new Date(item.last_updated).getTime() / 1000,
        ),
        sparkline: item.sparkline_in_7d?.price ?? [],
      },
    ]),
  );
  if (!cryptoRows.length) {
    const yahooCrypto = (
      await Promise.all([
        fetchYahooCrypto("BTC-USD", "bitcoin"),
        fetchYahooCrypto("ETH-USD", "ethereum"),
        fetchYahooCrypto("SOL-USD", "solana"),
      ])
    ).filter(Boolean);
    crypto = Object.fromEntries(yahooCrypto);
  }
  const fetchedAt = new Date().toISOString();
  const cryptoSource = cryptoRows.length
    ? "CoinGecko"
    : Object.keys(crypto).length
      ? "Yahoo Finance"
      : null;
  return json(
    {
      crypto: {
        bitcoin: crypto.bitcoin,
        ethereum: crypto.ethereum,
        solana: crypto.solana,
      },
      fx: {
        usd: byCode("USD"),
        eur: byCode("EUR"),
        gbp: byCode("GBP"),
      },
      fetchedAt,
      asOf: fetchedAt,
      delay: {
        crypto: "provider-dependent",
        fx: "official-daily-reference-rate",
      },
      stale: false,
      sources: {
        crypto: cryptoSource,
        fx: currencies.length ? "National Bank of Georgia" : null,
      },
      partial: !Object.keys(crypto).length || !currencies.length,
    },
    {
      headers: {
        "cache-control":
          "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

function cleanSymbols(value = "") {
  return [...new Set(
    value
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => /^[A-Z0-9^=.-]{1,12}$/.test(symbol)),
  )].slice(0, 20);
}

async function fetchQuote(symbol) {
  try {
    const payload = await fetchJson(
      `${YAHOO_CHART_URL}${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      6000,
      { "user-agent": "Investors.ge market news/2.0" },
    );
    const meta = payload.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const previousClose = Number(meta?.chartPreviousClose);
    if (
      !Number.isFinite(price) ||
      !Number.isFinite(previousClose) ||
      !previousClose
    ) {
      return null;
    }
    return {
      symbol: meta.symbol || symbol,
      price,
      currency: meta.currency || null,
      changePercent: ((price - previousClose) / previousClose) * 100,
      marketTime: meta.regularMarketTime || null,
    };
  } catch {
    return null;
  }
}

async function serveQuotes(url) {
  const symbols = cleanSymbols(url.searchParams.get("symbols"));
  const results = await Promise.all(symbols.map(fetchQuote));
  return json(
    {
      quotes: Object.fromEntries(
        results.filter(Boolean).map((quote) => [quote.symbol, quote]),
      ),
      source: "Yahoo Finance",
      fetchedAt: new Date().toISOString(),
      delay: "provider-dependent",
      stale: false,
    },
    {
      headers: {
        "cache-control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

async function serveAssetSearch(url) {
  const query = (url.searchParams.get("q") || "").trim().slice(0, 80);
  if (!query) return json({ assets: [] }, { headers: { "cache-control": "no-store" } });
  const exchangeMap = { NMS: "NASDAQ", NGM: "NASDAQ", NYQ: "NYSE", PCX: "AMEX", BTS: "CBOE", NEO: "NEO" };
  try {
    const upstream = new URL("https://query2.finance.yahoo.com/v1/finance/search");
    upstream.searchParams.set("q", query);
    upstream.searchParams.set("quotesCount", "10");
    upstream.searchParams.set("newsCount", "0");
    upstream.searchParams.set("listsCount", "0");
    const data = await fetchJson(upstream, 6000, { "user-agent": "Mozilla/5.0 Investors.ge" });
    const assets = (data.quotes || [])
      .filter(item => item?.symbol && ["EQUITY", "ETF", "CRYPTOCURRENCY"].includes(item.quoteType))
      .map(item => {
        const isCrypto = item.quoteType === "CRYPTOCURRENCY";
        const exchangeCode = exchangeMap[item.exchange] || item.exchDisp || item.exchange || "";
        const symbol = isCrypto ? item.symbol.replace(/-USD$/i, "") : item.symbol;
        return {
          type: isCrypto ? "crypto" : "security",
          symbol,
          yahooSymbol: item.symbol,
          name: item.longname || item.shortname || item.symbol,
          exchange: item.exchDisp || item.exchange || "",
          kind: item.quoteType === "ETF" ? "etf" : isCrypto ? "crypto" : "stock",
          typeLabel: item.typeDisp || item.quoteType,
          ...(isCrypto ? { externalUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(item.symbol)}` } : { tv: `${exchangeCode}:${item.symbol.replace(".", "-")}` }),
        };
      });
    return json({ assets }, { headers: { "cache-control": "public, max-age=60" } });
  } catch {
    return json({ assets: [] }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}

async function serveMarketSeries(url) {
  const rangeKey = url.searchParams.get("range") || "1m";
  const selection = MARKET_SERIES_RANGES[rangeKey];
  if (!selection) {
    return json(
      { error: "INVALID_RANGE", supportedRanges: Object.keys(MARKET_SERIES_RANGES) },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const payload = await fetchJson(
      `${YAHOO_CHART_URL}SPY?interval=${selection.interval}&range=${selection.range}`,
      7000,
      { "user-agent": "Investors.ge SPY market chart/1.0" },
    );
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const points = timestamps
      .map((timestamp, index) => ({
        timestamp: Number(timestamp),
        close: Number(closes[index]),
      }))
      .filter(
        (point) =>
          Number.isFinite(point.timestamp) &&
          Number.isFinite(point.close) &&
          point.close > 0,
      );
    if (points.length < 2) throw new Error("Insufficient series data");

    const start = points[0].close;
    const latest = points.at(-1).close;
    const meta = result.meta ?? {};
    return json(
      {
        symbol: "SPY",
        name: "SPDR S&P 500 ETF Trust",
        instrumentType: "ETF",
        exchange: meta.fullExchangeName || meta.exchangeName || "NYSE Arca",
        currency: meta.currency || "USD",
        marketState: meta.marketState || null,
        marketTime: meta.regularMarketTime || points.at(-1).timestamp,
        range: rangeKey,
        rangeLabel: selection.label,
        interval: selection.interval,
        start,
        latest,
        change: latest - start,
        changePercent: start ? ((latest - start) / start) * 100 : null,
        points,
        source: "Yahoo Finance",
        delayNotice: "მონაცემები შესაძლოა დაგვიანებული იყოს",
        fetchedAt: new Date().toISOString(),
        asOf: new Date((meta.regularMarketTime || points.at(-1).timestamp) * 1000).toISOString(),
        delay: "provider-dependent",
        stale: false,
      },
      {
        headers: {
          "cache-control":
            "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return json(
      {
        error: "MARKET_SERIES_UNAVAILABLE",
        message: "SPY market series is temporarily unavailable.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/news-ingest" && request.method === "POST") {
      return ingestNews(request, env);
    }
    if (url.pathname === "/api/editorial/pending" && request.method === "GET") {
      return listPendingEditorialReviews(request, env);
    }
    if (url.pathname === "/api/editorial/review" && request.method === "POST") {
      return reviewGeorgianArticle(request, env);
    }
    if (url.pathname === "/data/global-news.json") return serveNews(env);
    if (url.pathname === "/api/market-data") return serveMarketData();
    if (url.pathname === "/api/market-series") return serveMarketSeries(url);
    if (url.pathname === "/api/status") return serveStatus(env);
    if (url.pathname === "/api/asset-search") return serveAssetSearch(url);
    if (url.pathname === "/api/news-quotes") return serveQuotes(url);
    const articleMatch = url.pathname.match(/^\/news\/([a-f0-9]{16})\/?$/i);
    if (articleMatch && request.method === "GET") {
      return serveNewsArticle(request, env, articleMatch[1]);
    }
    return env.ASSETS.fetch(request);
  },

};
