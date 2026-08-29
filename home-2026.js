(function () {
  "use strict";

  /* ── theme toggle ─────────────────────────────── */
  const THEME_KEY = "inv-theme";
  const themeButton = document.querySelector("[data-theme-toggle]");
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeButton) themeButton.textContent = theme === "dark" ? "☾" : "☀";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0c0f17" : "#f6f7f9");
  }
  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  themeButton?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  });

  /* ── formatting helpers ───────────────────────── */
  const money = (value, digits = 2) =>
    "$" + Number(value).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0 });
  const plain = (value, digits = 2) =>
    Number(value).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0 });
  function signedPercent(value) {
    const number = Number(value) || 0;
    return `${number >= 0 ? "▲ +" : "▼ −"}${Math.abs(number).toFixed(2)}%`;
  }
  function setSlot(name, value, change, positive) {
    const root = document.querySelector(`[data-t26="${name}"]`);
    if (!root) return;
    const valueNode = root.querySelector("[data-t26-value]");
    const changeNode = root.querySelector("[data-t26-change]");
    if (valueNode && value != null && valueNode.textContent !== value) {
      valueNode.textContent = value;
      valueNode.classList.remove("tick-flash");
      void valueNode.offsetWidth;
      valueNode.classList.add("tick-flash");
    }
    if (changeNode && change != null) {
      changeNode.textContent = change;
      if (positive != null) changeNode.className = "num " + (positive ? "up" : "down");
      changeNode.setAttribute("data-t26-change", "");
    }
  }

  function sparkline(svg, values, positive) {
    if (!svg || !Array.isArray(values) || values.length < 2) return;
    const width = 64, height = 26, pad = 2;
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const x = (index) => pad + (index * (width - pad * 2)) / (values.length - 1);
    const y = (value) => height - pad - ((value - min) / span) * (height - pad * 2);
    const d = values
      .map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
      .join("");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `<path d="${d}" fill="none" stroke="${positive ? "var(--t-up)" : "var(--t-down)"}" stroke-width="1.8" stroke-linejoin="round"/>`;
  }

  /* ── live market data: ticker + movers ────────── */
  const WATCHLIST = [
    { symbol: "NVDA", name: "Nvidia Corp" },
    { symbol: "AAPL", name: "Apple Inc" },
    { symbol: "MSFT", name: "Microsoft Corp" },
    { symbol: "TSLA", name: "Tesla Inc" },
    { symbol: "COIN", name: "Coinbase Global" },
  ];
  const QUOTE_SYMBOLS = ["^GSPC", "QQQ", "GC=F", ...WATCHLIST.map((item) => item.symbol)];
  const seriesCache = {};

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} → ${response.status}`);
    return response.json();
  }

  function renderMovers(quotes) {
    const container = document.getElementById("t26Movers");
    if (!container) return;
    const rows = WATCHLIST
      .map((item) => ({ ...item, quote: quotes[item.symbol] }))
      .filter((item) => item.quote && Number.isFinite(item.quote.changePercent))
      .sort((a, b) => Math.abs(b.quote.changePercent) - Math.abs(a.quote.changePercent))
      .slice(0, 4);
    if (!rows.length) {
      container.innerHTML = '<div class="news-status">მონაცემები დროებით მიუწვდომელია.</div>';
      return;
    }
    container.innerHTML = rows
      .map((item) => {
        const positive = item.quote.changePercent >= 0;
        return `<a class="mrow" href="/stocks/${encodeURIComponent(item.symbol)}" aria-label="${item.symbol}, ${signedPercent(item.quote.changePercent)}">
          <span><b>${item.symbol}</b><small>${item.name}</small></span>
          <svg data-mover-spark="${item.symbol}"></svg>
          <span class="num ${positive ? "up" : "down"}">${signedPercent(item.quote.changePercent)}</span>
        </a>`;
      })
      .join("");
    rows.forEach(async (item) => {
      try {
        if (!seriesCache[item.symbol]) {
          const payload = await fetchJson(`/api/company-series?symbol=${encodeURIComponent(item.symbol)}&range=5d`);
          seriesCache[item.symbol] = (payload.points || []).map((point) => point.close);
        }
        sparkline(
          container.querySelector(`[data-mover-spark="${item.symbol}"]`),
          seriesCache[item.symbol],
          item.quote.changePercent >= 0,
        );
      } catch (_) { /* sparkline is decorative — the signed % carries the value */ }
    });
  }

  function markUnavailable() {
    document.querySelectorAll("[data-t26] [data-t26-change]").forEach((node) => {
      if (node.textContent === "იტვირთება") {
        node.textContent = "მიუწვდომელია";
        node.className = "num";
      }
    });
  }

  async function refreshMarkets() {
    const [marketResult, quotesResult] = await Promise.allSettled([
      fetchJson("/api/market-data"),
      fetchJson(`/api/news-quotes?symbols=${encodeURIComponent(QUOTE_SYMBOLS.join(","))}`),
    ]);
    const market = marketResult.status === "fulfilled" ? marketResult.value : null;
    const quotes = quotesResult.status === "fulfilled" ? quotesResult.value.quotes || {} : {};
    if (!market && quotesResult.status !== "fulfilled") {
      markUnavailable();
      const movers = document.getElementById("t26Movers");
      if (movers) movers.innerHTML = '<div class="news-status">ფასების განახლება დროებით შეფერხებულია.</div>';
      return;
    }

    const sp = quotes["^GSPC"], qqq = quotes.QQQ, gold = quotes["GC=F"];
    if (sp) setSlot("sp500", plain(sp.price), signedPercent(sp.changePercent), sp.changePercent >= 0);
    if (qqq) setSlot("nasdaq", money(qqq.price), signedPercent(qqq.changePercent), qqq.changePercent >= 0);
    if (gold) setSlot("gold", money(gold.price, 1), signedPercent(gold.changePercent), gold.changePercent >= 0);

    if (market) {
      const btc = market.crypto?.bitcoin, eth = market.crypto?.ethereum, usd = market.fx?.usd;
      if (btc?.usd) setSlot("btc", "$" + plain(btc.usd, 0), signedPercent(btc.usd_24h_change), (btc.usd_24h_change || 0) >= 0);
      if (eth?.usd) setSlot("eth", "$" + plain(eth.usd, 0), signedPercent(eth.usd_24h_change), (eth.usd_24h_change || 0) >= 0);
      if (usd?.rate) {
        const diff = Number(usd.diff || 0);
        setSlot("usdgel", Number(usd.rate).toFixed(4), `${diff >= 0 ? "▲ +" : "▼ −"}${Math.abs(diff).toFixed(4)} NBG`, diff >= 0);
      }
      const updated = document.querySelector("[data-t26-updated]");
      if (updated && market.fetchedAt) {
        updated.textContent = "განახლდა " + new Date(market.fetchedAt).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" });
      }
    }
    if (quotesResult.status === "fulfilled") renderMovers(quotes);
    else {
      const movers = document.getElementById("t26Movers");
      if (movers) movers.innerHTML = '<div class="news-status">ფასების განახლება დროებით შეფერხებულია.</div>';
    }
    markUnavailable();
  }

  refreshMarkets();
  setInterval(refreshMarkets, 60000);
})();
