const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const MAX_SYMBOLS = 20;

function cleanSymbols(value = "") {
  return [...new Set(
    value
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => /^[A-Z0-9^=.-]{1,12}$/.test(symbol)),
  )].slice(0, MAX_SYMBOLS);
}

async function fetchQuote(symbol) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(
      `${YAHOO_CHART_URL}${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "Investors.ge market news/1.0",
        },
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const meta = payload.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const previousClose = Number(meta?.chartPreviousClose);
    if (!Number.isFinite(price) || !Number.isFinite(previousClose) || !previousClose) {
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
  } finally {
    clearTimeout(timeout);
  }
}

export default async (request) => {
  const symbols = cleanSymbols(new URL(request.url).searchParams.get("symbols"));
  if (!symbols.length) {
    return Response.json(
      { quotes: {}, source: "Yahoo Finance", fetchedAt: new Date().toISOString() },
      { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
    );
  }

  const results = await Promise.all(symbols.map(fetchQuote));
  const quotes = Object.fromEntries(
    results.filter(Boolean).map((quote) => [quote.symbol, quote]),
  );
  return Response.json(
    { quotes, source: "Yahoo Finance", fetchedAt: new Date().toISOString() },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        "access-control-allow-origin": "*",
        "x-content-type-options": "nosniff",
      },
    },
  );
};
