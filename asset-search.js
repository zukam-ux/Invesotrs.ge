(() => {
  let catalogPromise;
  const popularSecurities = new Set(["SPCX", "AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "QQQ", "SPY"]);
  const canonicalCoins = new Set(["bitcoin", "ethereum", "solana", "ripple", "binancecoin", "dogecoin", "cardano", "avalanche-2", "chainlink", "sui"]);

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

  function score(asset, query) {
    const symbol = asset.symbol.toLowerCase();
    const name = asset.name.toLowerCase();
    const aliases = (asset.aliases || "").toLowerCase();
    let value = 0;
    if (symbol === query) value += 140;
    else if (symbol.startsWith(query)) value += 80;
    else if (symbol.includes(query)) value += 25;
    if (name === query) value += 160;
    else if (name.startsWith(query)) value += 90;
    else if (name.includes(query)) value += 40;
    if (aliases === query) value += 180;
    else if (aliases.startsWith(query)) value += 100;
    else if (aliases.includes(query)) value += 45;
    if (asset.type === "security") value += 25;
    if (asset.type === "security" && popularSecurities.has(asset.symbol)) value += 150;
    if (asset.type === "crypto" && canonicalCoins.has(asset.id)) value += 90;
    return value;
  }

  function assetUrl(asset) {
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
    const kind = asset.type === "crypto" ? "კრიპტო · CoinGecko" : `${asset.exchange} · SEC`;
    return `<a class="asset-result" href="${escapeHtml(assetUrl(asset))}">
      <i>${escapeHtml(asset.symbol.slice(0, 4))}</i>
      <span><b>${escapeHtml(asset.name)}</b><small>${escapeHtml(asset.symbol)} · ${escapeHtml(kind)}</small></span>
      <em>›</em>
    </a>`;
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
        const assets = await loadCatalog();
        if (current !== request) return;
        const matches = assets
          .map(asset => [asset, score(asset, query)])
          .filter(([, value]) => value > 0)
          .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name))
          .slice(0, 10)
          .map(([asset]) => asset);
        results.innerHTML = matches.length
          ? matches.map(renderResult).join("")
          : `<div class="asset-search-state">„${escapeHtml(input.value.trim())}“ ვერ მოიძებნა</div>`;
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

  document.querySelectorAll("[data-asset-search]").forEach(attach);
  document.addEventListener("click", event => {
    if (!event.target.closest(".asset-search")) {
      document.querySelectorAll(".asset-search-results").forEach(el => el.classList.remove("open"));
    }
  });
})();
