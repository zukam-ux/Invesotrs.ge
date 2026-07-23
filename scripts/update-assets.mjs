import fs from "node:fs/promises";

const SEC_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const COINS_URL = "https://api.coingecko.com/api/v3/coins/list?include_platform=false";
const headers = { "User-Agent": "Investors.ge market directory contact@investors.ge" };

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

const [sec, coins] = await Promise.all([
  getJson(SEC_URL, { headers }),
  getJson(COINS_URL),
]);

const exchangeMap = {
  Nasdaq: "NASDAQ",
  NYSE: "NYSE",
  "NYSE Arca": "AMEX",
  "NYSE American": "AMEX",
  Cboe: "CBOE",
  OTC: "OTC",
};
const securityAliases = {
  "0001181412": "SpaceX",
  "0001652044": "Google",
  "0001326801": "Facebook",
};

const securities = sec.data
  .filter(([, name, ticker, exchange]) => name && ticker && exchange)
  .map(([cik, name, ticker, exchange]) => {
    const paddedCik = String(cik).padStart(10, "0");
    return {
      type: "security",
      symbol: ticker,
      name,
      exchange,
      tv: `${exchangeMap[exchange] || exchange.toUpperCase().replace(/\s+/g, "")}:${ticker.replace(".", "-")}`,
      cik: paddedCik,
      ...(securityAliases[paddedCik] ? { aliases: securityAliases[paddedCik] } : {}),
    };
  });

const crypto = coins
  .filter(({ id, symbol, name }) => id && symbol && name && symbol.length <= 16)
  .map(({ id, symbol, name }) => ({
    type: "crypto",
    symbol: symbol.toUpperCase(),
    name,
    id,
  }));

const payload = {
  updatedAt: new Date().toISOString(),
  sources: {
    securities: "U.S. Securities and Exchange Commission",
    crypto: "CoinGecko",
  },
  counts: { securities: securities.length, crypto: crypto.length },
  assets: [...securities, ...crypto],
};

await fs.mkdir("data", { recursive: true });
await fs.writeFile("data/assets.json", JSON.stringify(payload));
console.log(`Wrote ${payload.assets.length} assets (${securities.length} securities, ${crypto.length} crypto).`);
