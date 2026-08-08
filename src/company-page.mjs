const FACTS = [
  ["revenue", ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues"], "შემოსავალი"],
  ["netIncome", ["NetIncomeLoss", "ProfitLoss"], "წმინდა მოგება"],
  ["assets", ["Assets"], "აქტივები"],
  ["liabilities", ["Liabilities"], "ვალდებულებები"],
  ["equity", ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], "კაპიტალი"],
  ["operatingIncome", ["OperatingIncomeLoss"], "საოპერაციო მოგება"],
  ["cash", ["CashAndCashEquivalentsAtCarryingValue"], "ფულადი სახსრები"],
  ["eps", ["EarningsPerShareDiluted", "EarningsPerShareBasic"], "მოგება აქციაზე"],
];

export function normalizeStockSymbol(value = "") {
  const symbol = String(value).trim().toUpperCase();
  return /^[A-Z0-9.-]{1,15}$/.test(symbol) ? symbol : "";
}

function latestFact(companyFacts, concepts) {
  for (const concept of concepts) {
    const fact = companyFacts?.facts?.["us-gaap"]?.[concept];
    if (!fact?.units) continue;
    const rows = Object.entries(fact.units).flatMap(([unit, values]) => values.map(row => ({ ...row, unit })));
    const latest = rows
      .filter(row => ["10-K", "10-Q", "20-F", "40-F"].includes(row.form))
      .filter(row => Number.isFinite(Number(row.val)) && row.end && row.filed)
      .sort((a, b) => b.filed.localeCompare(a.filed) || b.end.localeCompare(a.end))[0];
    if (latest) return { concept, label: fact.label, ...latest, val: Number(latest.val) };
  }
  return null;
}

export function extractFundamentals(companyFacts) {
  return FACTS.map(([key, concepts, label]) => ({ key, label, fact: latestFact(companyFacts, concepts) })).filter(item => item.fact);
}

export function extractFilings(submissions, limit = 8) {
  const recent = submissions?.filings?.recent || {};
  return (recent.accessionNumber || []).map((accessionNumber, index) => {
    const primaryDocument = recent.primaryDocument?.[index] || "";
    const cik = String(submissions.cik || "").replace(/^0+/, "");
    return {
      accessionNumber,
      form: recent.form?.[index] || "",
      filingDate: recent.filingDate?.[index] || "",
      reportDate: recent.reportDate?.[index] || "",
      description: recent.primaryDocDescription?.[index] || "",
      url: cik && primaryDocument ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber.replaceAll("-", "")}/${primaryDocument}` : "",
    };
  }).filter(item => item.form && item.url).slice(0, limit);
}

export function buildCompanyData(asset, submissions, companyFacts, quote, fetchedAt = new Date().toISOString()) {
  return {
    symbol: asset.symbol, name: submissions.name || asset.name,
    exchange: asset.exchange || submissions.exchanges?.[0] || "",
    cik: String(asset.cik || submissions.cik || "").padStart(10, "0"), kind: asset.kind || "stock",
    profile: { sic: submissions.sic || "", industry: submissions.sicDescription || "", fiscalYearEnd: submissions.fiscalYearEnd || "", state: submissions.stateOfIncorporation || "", website: submissions.website || "", investorWebsite: submissions.investorWebsite || "", phone: submissions.phone || "", address: submissions.addresses?.business || null, formerNames: submissions.formerNames || [] },
    quote, fundamentals: extractFundamentals(companyFacts), filings: extractFilings(submissions),
    sources: { company: "U.S. Securities and Exchange Commission (SEC EDGAR)", quote: quote ? "Yahoo Finance" : null },
    fetchedAt, quoteDelay: "provider-dependent",
  };
}

function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function formatValue(value, unit) {
  if (!Number.isFinite(value)) return "—";
  if (/shares/.test(unit)) return `$${value.toFixed(2)}`;
  return new Intl.NumberFormat("ka-GE", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function renderCompanyPage(company) {
  const q = company.quote;
  const title = `${company.name} (${company.symbol}) — კომპანიის ინფორმაცია და აქციის ფასი | Investors.ge`;
  const description = `${company.name}: აქციის ფასი, კომპანიის პროფილი, ფინანსური მაჩვენებლები და SEC დოკუმენტები ქართულად.`;
  const address = company.profile.address;
  const addressText = address ? [address.street1, address.street2, address.city, address.stateOrCountry, address.zipCode].filter(Boolean).join(", ") : "—";
  const facts = company.fundamentals.map(({ label, fact }) => `<article><span>${escapeHtml(label)}</span><strong>${formatValue(fact.val, fact.unit)}</strong><small>${escapeHtml(fact.form)} · ${escapeHtml(fact.end)}</small></article>`).join("");
  const filings = company.filings.map(item => `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><b>${escapeHtml(item.form)}</b><span>${escapeHtml(item.description || "SEC დოკუმენტი")}</span><time>${escapeHtml(item.filingDate)}</time></a></li>`).join("");
  const schema = JSON.stringify({ "@context": "https://schema.org", "@type": "Corporation", name: company.name, tickerSymbol: company.symbol, url: `https://investors.ge/stocks/${encodeURIComponent(company.symbol)}` }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="https://investors.ge/stocks/${encodeURIComponent(company.symbol)}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${schema}</script><style>body{background:#f5f8f6;color:#10271e}.company-wrap{max-width:1180px;margin:auto;padding:32px 22px 72px}.company-nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}.company-nav a{color:#087852;text-decoration:none;font-weight:800}.hero,.panel{background:#fff;border:1px solid #dbe8e1;border-radius:22px;box-shadow:0 12px 34px rgba(16,39,30,.06)}.hero{padding:28px}.eyebrow{color:#087852;font:800 12px/1.2 sans-serif;letter-spacing:.08em;text-transform:uppercase}.hero h1{font-size:clamp(30px,5vw,54px);margin:8px 0 4px}.meta,.source-note,small{color:#64776f}.quote{display:flex;gap:16px;align-items:baseline;margin-top:22px}.quote strong{font-size:38px}.up{color:#087852}.down{color:#b33a3a}.grid{display:grid;grid-template-columns:1.45fr .75fr;gap:20px;margin-top:20px}.panel{padding:24px}.panel h2{margin:0 0 18px}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.facts article{padding:16px;background:#f7faf8;border-radius:14px}.facts span,.facts strong,.facts small{display:block}.facts strong{font-size:22px;margin:5px 0}.profile{display:grid;grid-template-columns:1fr 1fr;gap:14px}.profile div{border-bottom:1px solid #e4ece7;padding-bottom:10px}.profile span,.profile b{display:block}.filings{list-style:none;padding:0;margin:0}.filings li+li{border-top:1px solid #e4ece7}.filings a{display:grid;grid-template-columns:70px 1fr 100px;gap:12px;padding:13px 0;color:inherit;text-decoration:none}.source-note{font-size:13px;line-height:1.6;margin-top:18px}@media(max-width:760px){.grid{grid-template-columns:1fr}.facts,.profile{grid-template-columns:1fr}.filings a{grid-template-columns:55px 1fr}.filings time{display:none}}</style></head><body><main class="company-wrap"><nav class="company-nav"><a href="/">INVESTORS.GE</a><a href="/markets.html">← ბაზრები</a></nav><section class="hero"><div class="eyebrow">${escapeHtml(company.exchange)} · ${escapeHtml(company.symbol)}</div><h1>${escapeHtml(company.name)}</h1><div class="meta">CIK ${escapeHtml(company.cik)} · ${escapeHtml(company.profile.industry || "კომპანიის პროფილი")}</div>${q ? `<div class="quote"><strong>${escapeHtml(q.currency || "USD")} ${Number(q.price).toLocaleString("en-US", { maximumFractionDigits: 4 })}</strong><b class="${q.changePercent >= 0 ? "up" : "down"}">${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%</b></div><small>ფასი შესაძლოა დაგვიანებული იყოს · ${escapeHtml(q.marketTime ? new Date(q.marketTime * 1000).toISOString() : company.fetchedAt)}</small>` : `<div class="quote"><strong>ფასი დროებით მიუწვდომელია</strong></div>`}</section><div class="grid"><section class="panel"><h2>ფინანსური მაჩვენებლები</h2><div class="facts">${facts || "SEC-ის სტანდარტიზებული მაჩვენებლები ამ ემიტენტისთვის ვერ მოიძებნა."}</div><p class="source-note">წყარო: SEC EDGAR XBRL. პერიოდები და ანგარიშგების ფორმები თითოეულ მაჩვენებელთანაა მითითებული; ისინი ერთმანეთისგან შეიძლება განსხვავდებოდეს.</p></section><aside class="panel"><h2>კომპანიის შესახებ</h2><div class="profile"><div><span>ინდუსტრია</span><b>${escapeHtml(company.profile.industry || "—")}</b></div><div><span>ფისკალური წელი</span><b>${escapeHtml(company.profile.fiscalYearEnd || "—")}</b></div><div><span>რეგისტრაცია</span><b>${escapeHtml(company.profile.state || "—")}</b></div><div><span>ტელეფონი</span><b>${escapeHtml(company.profile.phone || "—")}</b></div><div><span>მისამართი</span><b>${escapeHtml(addressText)}</b></div><div><span>ვებსაიტი</span><b>${company.profile.website ? `<a href="${escapeHtml(company.profile.website)}" target="_blank" rel="noopener">ოფიციალური საიტი</a>` : "—"}</b></div></div></aside></div><section class="panel" style="margin-top:20px"><h2>ბოლო SEC დოკუმენტები</h2><ul class="filings">${filings || "<li>დოკუმენტები ვერ მოიძებნა.</li>"}</ul></section><p class="source-note">კომპანიის მონაცემები: U.S. SEC EDGAR · ფასი: Yahoo Finance, provider-dependent delay · განახლება: ${escapeHtml(company.fetchedAt)}. Investors.ge არ არის საინვესტიციო მრჩეველი.</p></main></body></html>`;
}

export function renderCompanyNotFound(symbol) {
  return `<!doctype html><html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>კომპანია ვერ მოიძებნა | Investors.ge</title></head><body><main style="max-width:720px;margin:10vh auto;padding:24px;font-family:sans-serif"><a href="/markets.html">← ბაზრები</a><h1>${escapeHtml(symbol || "სიმბოლო")} ვერ მოიძებნა</h1><p>შეამოწმეთ ტიკერი ან მოძებნეთ კომპანია ბაზრების გვერდიდან.</p></main></body></html>`;
}
