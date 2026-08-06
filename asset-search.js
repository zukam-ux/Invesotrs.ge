let catalogPromise;
  const popularSecurities = new Set(["AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "QQQ", "SPY"]);
  const canonicalCoins = new Set(["bitcoin", "ethereum", "solana", "ripple", "binancecoin", "dogecoin", "cardano", "avalanche-2", "chainlink", "sui"]);
  const queryAliases = new Map([
    ["btc", "bitcoin"],
    ["xbt", "bitcoin"],
    ["eth", "ethereum"],
  ]);
  const securityQueryAliases = new Map([
    ["apple", "AAPL"],
    ["google", "GOOGL"],
    ["facebook", "META"],
    ["spacex", "SPCX"],
    ["space x", "SPCX"],
  ]);

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch("/data/assets.json")
        .then(response => {
          if (!response.ok) throw new Error("Asset directory unavailable");
          return response.json();
        })
        .then(data => data.assets || []);
    }
    return catalogPromise;
  }

  function normalized(value = "") {
    return String(value).toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()•]/g, " ").replace(/\s+/g, " ").trim();
  }

  function assetKind(asset) {
    if (asset.kind) return asset.kind;
    if (asset.type === "crypto") return /tokenized|xstock|robinhood token|ondo|backpack securities|dinari/i.test(asset.name) ? "tokenized" : "crypto";
    if (/warrant/i.test(asset.name) || /-WT$|W$/.test(asset.symbol)) return "warrant";
    if (/preferred/i.test(asset.name) || /-P[A-Z]$/.test(asset.symbol)) return "preferred";
    if (/\bETF\b|\bFUND\b|\bTRUST\b/i.test(asset.name)) return "etf";
    return asset.exchange === "OTC" ? "otc" : "stock";
  }

  export function scoreAsset(asset, rawQuery) {
    const query = normalized(rawQuery);
    const canonicalQuery = queryAliases.get(query) || query;
    const securityAlias = securityQueryAliases.get(query);
    const symbol = asset.symbol.toLowerCase();
    const name = normalized(asset.name);
    const aliases = normalized(asset.aliases);
    const words = name.split(" ");
    let value = 0;
    if (symbol === query) value = 1000;
    else if (symbol.startsWith(query)) value = 720;
    else if (symbol.includes(query)) value = 420;
    if (name === query) value = Math.max(value, 950);
    else if (name.startsWith(query)) value = Math.max(value, 780);
    else if (words.some(word => word === query)) value = Math.max(value, 650);
    else if (name.includes(query)) value = Math.max(value, 520);
    if (aliases === query) value = Math.max(value, 980);
    else if (aliases.startsWith(query)) value = Math.max(value, 800);
    else if (aliases.includes(query)) value = Math.max(value, 560);
    if (asset.type === "crypto" && canonicalCoins.has(asset.id) && (asset.id === canonicalQuery || name === canonicalQuery)) {
      value = Math.max(value, 1250);
    }
    if (asset.type === "security" && securityAlias === asset.symbol) value = Math.max(value, 1250);
    if (!value && canonicalQuery !== query && asset.type === "crypto" && asset.id === canonicalQuery) value = 1250;
    if (!value) return 0;
    const kind = assetKind(asset);
    if (asset.type === "security" && popularSecurities.has(asset.symbol)) value += 12;
    if (asset.type === "crypto" && canonicalCoins.has(asset.id)) value += 35;
    if (kind === "stock") value += 25;
    if (kind === "tokenized") value -= 80;
    if (kind === "otc" || kind === "warrant" || kind === "preferred") value -= 30;
    return value;
  }

  export function rankAssets(assets, query, limit = 20) {
    return assets
      .map(asset => [asset, scoreAsset(asset, query)])
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name))
      .slice(0, limit)
      .map(([asset]) => asset);
  }

  function assetUrl(asset) {
    if (asset.externalUrl) return asset.externalUrl;
    const params = new URLSearchParams({
      type: asset.type,
      symbol: asset.symbol,
      name: asset.name,
    });
    if (asset.tv) params.set("tv", asset.tv);
    if (asset.exchange) params.set("exchange", asset.exchange);
    if (asset.cik) params.set("cik", asset.cik);
    if (asset.id) params.set("coin", asset.id);
    return `markets.html?${params}`;
  }

  function renderResult(asset) {
    const quoteSymbol = asset.yahooSymbol || (asset.type === "crypto" ? `${asset.symbol}-USD` : asset.symbol);
    const liveQuote = asset.yahooSymbol ? "" : ` <span data-live-quote="${escapeHtml(quoteSymbol)}"></span>`;
    const labels = {
      stock: `${asset.exchange || "აშშ"} · აქცია`,
      etf: `${asset.exchange || "აშშ"} · ETF / ფონდი`,
      crypto: "კრიპტოაქტივი",
      tokenized: "ტოკენიზებული აქტივი · არ არის კომპანიის აქცია",
      warrant: `${asset.exchange || "აშშ"} · ვარანტი`,
      preferred: `${asset.exchange || "აშშ"} · პრივილეგირებული აქცია`,
      otc: "OTC ფასიანი ქაღალდი",
    };
    const kind = labels[assetKind(asset)] || "ფინანსური აქტივი";
    const resultMeta = asset.yahooSymbol ? asset.symbol : `${asset.symbol} · ${kind}`;
    const typeLabel = asset.typeLabel || (assetKind(asset) === "stock" ? "Equity" : assetKind(asset) === "etf" ? "ETF" : asset.type === "crypto" ? "Cryptocurrency" : assetKind(asset).toUpperCase());
    const external = asset.externalUrl ? ' target="_blank" rel="noopener"' : "";
    return `<a class="asset-result" href="${escapeHtml(assetUrl(asset))}"${external}>
      <i>${escapeHtml(asset.symbol.slice(0, 4))}</i>
      <span><b>${escapeHtml(asset.name)}${liveQuote}</b><small>${escapeHtml(resultMeta)}</small></span>
      <em class="asset-result-type"><b>${escapeHtml(typeLabel)}</b><small>${escapeHtml(asset.exchange || (asset.type === "crypto" ? "CoinGecko" : ""))}</small></em>
    </a>`;
  }

  function renderMatches(matches, query) {
    return `<div class="asset-results-heading"><b>სიმბოლოები</b><span>ტიპი</span></div>${matches.slice(0, 10).map(renderResult).join("")}`;
  }

  async function loadYahooMatches(query) {
    const response = await fetch(`/api/asset-search?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.assets) ? data.assets : [];
  }

  function attach(input) {
    const host = input.closest(".asset-search") || input.parentElement;
    const results = host.querySelector(".asset-search-results");
    if (!results) return;
    let request = 0;

    async function search() {
      const query = input.value.trim().toLowerCase();
      const current = ++request;
      if (query.length < 1) {
        results.classList.remove("open");
        results.innerHTML = "";
        return;
      }
      results.classList.add("open");
      results.innerHTML = '<div class="asset-search-state">იტვირთება…</div>';
      try {
        const [assets, yahooMatches] = await Promise.all([loadCatalog(), loadYahooMatches(query).catch(() => [])]);
        if (current !== request) return;
        const matches = yahooMatches.length ? yahooMatches : rankAssets(assets, query, 20);
        results.innerHTML = matches.length
          ? renderMatches(matches, query)
          : `<div class="asset-search-state">„${escapeHtml(input.value.trim())}“ ვერ მოიძებნა</div>`;
        window.refreshLiveQuotes?.(results);
      } catch {
        results.innerHTML = '<div class="asset-search-state">ძიება დროებით მიუწვდომელია</div>';
      }
    }

    input.addEventListener("input", search);
    input.addEventListener("focus", () => input.value.trim() && search());
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        const first = results.querySelector("a");
        if (first) {
          event.preventDefault();
          location.href = first.href;
        }
      }
      if (event.key === "Escape") results.classList.remove("open");
    });
  }

if (typeof document !== "undefined") {
  document.querySelectorAll("[data-asset-search]").forEach(attach);
  document.addEventListener("click", event => {
    if (!event.target.closest(".asset-search")) {
      document.querySelectorAll(".asset-search-results").forEach(el => el.classList.remove("open"));
    }
  });
}
