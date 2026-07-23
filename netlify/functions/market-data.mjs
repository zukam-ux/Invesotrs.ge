const CRYPTO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";
const NBG_URL =
  "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/json/";

export default async () => {
  try {
    const [cryptoResponse, fxResponse] = await Promise.all([
      fetch(CRYPTO_URL, { headers: { accept: "application/json" } }),
      fetch(NBG_URL, { headers: { accept: "application/json" } }),
    ]);

    if (!cryptoResponse.ok || !fxResponse.ok) {
      throw new Error("Upstream market-data request failed");
    }

    const [crypto, fxRows] = await Promise.all([
      cryptoResponse.json(),
      fxResponse.json(),
    ]);
    const currencies = fxRows?.[0]?.currencies ?? [];
    const byCode = (code) => currencies.find((item) => item.code === code);

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
          crypto: "CoinGecko",
          fx: "National Bank of Georgia",
        },
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
