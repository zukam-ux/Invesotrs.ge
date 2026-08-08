const baseUrl = process.env.HEALTH_BASE_URL || "https://investors.ge";

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "application/json", "user-agent": "Investors.ge production health check/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const status = await readJson("/api/status");
if (status.status !== "operational") throw new Error(`Platform status is ${status.status}`);

const market = await readJson("/api/market-data");
if (!market.asOf || !market.delay || typeof market.stale !== "boolean") {
  throw new Error("Market data freshness metadata is incomplete");
}

const series = await readJson("/api/market-series?range=1d");
if (!series.asOf || !series.delay || typeof series.stale !== "boolean" || series.symbol !== "SPY") {
  throw new Error("Market series identity or freshness metadata is incomplete");
}

console.log(JSON.stringify({ status: "healthy", checkedAt: status.checkedAt, news: status.services.news, marketSource: market.sources, series: series.symbol }));
