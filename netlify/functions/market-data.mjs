const CRYPTO_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&price_change_percentage=24h&sparkline=true";
const NBG_URL =
  "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/json/";

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export default async () => {
  try {
    const [cryptoResult, fxResult] = await Promise.allSettled([
      fetchJson(CRYPTO_URL),
      fetchJson(NBG_URL),
    ]);

    const cryptoRows =
      cryptoResult.status === "fulfilled" ? cryptoResult.value : [];
    const fxRows = fxResult.status === "fulfilled" ? fxResult.value : [];
    if (!cryptoRows.length && !fxRows.length) {
      throw new Error("All upstream market-data requests failed");
    }
    const currencies = fxRows?.[0]?.currencies ?? [];
    const byCode = (code) => currencies.find((item) => item.code === code);
    const crypto = Object.fromEntries(
      cryptoRows.map((item) => [
        item.id,
        {
          usd: item.current_price,
          usd_24h_change: item.price_change_percentage_24h,
          last_updated_at: Math.floor(new Date(item.last_updated).getTime() / 1000),
          sparkline: item.sparkline_in_7d?.price ?? [],
        },
      ]),
    );

    return new Response(
      JSON.stringify({
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
        fetchedAt: new Date().toISOString(),
        sources: {
          crypto: cryptoRows.length ? "CoinGecko" : null,
          fx: currencies.length ? "National Bank of Georgia" : null,
        },
        partial: !cryptoRows.length || !currencies.length,
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
          "access-control-allow-origin": "*",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "MARKET_DATA_UNAVAILABLE",
        message: "Live market data is temporarily unavailable.",
        fetchedAt: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        },
      },
    );
  }
};
