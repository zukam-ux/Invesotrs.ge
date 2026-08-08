const esc = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const compact = number => Number.isFinite(number) ? new Intl.NumberFormat("ka-GE", { notation: "compact", maximumFractionDigits: 2 }).format(number) : "—";
const price = (number, currency = "USD") => Number.isFinite(number) ? `${Number(number).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${currency}` : "—";
const fact = (company, key) => company.fundamentals?.find(item => item.key === key)?.fact || null;
const factCell = item => item ? `${compact(item.val)}<span class="period">${esc(item.end)} · ${esc(item.form)}</span>` : "—";

export function renderComparison(companies) {
  const rows = [
    ["ფასი", company => price(company.quote?.price, company.quote?.currency)],
    ["დღიური ცვლილება", company => Number.isFinite(company.quote?.changePercent) ? `${company.quote.changePercent >= 0 ? "+" : ""}${company.quote.changePercent.toFixed(2)}%` : "—"],
    ["საბაზრო კაპიტალიზაცია", company => compact(company.valuation?.marketCap)],
    ["Price / Book", company => Number.isFinite(company.valuation?.priceToBook) ? company.valuation.priceToBook.toFixed(2) : "—"],
    ["შემოსავალი", company => factCell(fact(company, "revenue"))],
    ["წმინდა მოგება", company => factCell(fact(company, "netIncome"))],
    ["აქტივები", company => factCell(fact(company, "assets"))],
    ["EPS", company => factCell(fact(company, "eps"))],
  ];
  return `<table><thead><tr><th>მაჩვენებელი</th>${companies.map(company => `<th><a href="/stocks/${encodeURIComponent(company.symbol)}">${esc(company.symbol)}</a><span class="period">${esc(company.name)}</span></th>`).join("")}</tr></thead><tbody>${rows.map(([label, read]) => `<tr><th>${label}</th>${companies.map(company => `<td>${read(company)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

async function load(form, results) {
  const symbols = [...new FormData(form).getAll("symbol")].map(value => String(value).trim().toUpperCase()).filter(value => /^[A-Z0-9.-]{1,15}$/.test(value)).filter((value, index, all) => all.indexOf(value) === index).slice(0, 4);
  if (symbols.length < 2) { results.innerHTML = '<div class="state">შედარებისთვის შეიყვანეთ მინიმუმ ორი სწორი ტიკერი.</div>'; return; }
  results.innerHTML = '<div class="state">მონაცემები იტვირთება…</div>';
  const responses = await Promise.all(symbols.map(async symbol => { const response = await fetch(`/api/company?symbol=${encodeURIComponent(symbol)}`); return response.ok ? response.json() : null; }));
  const companies = responses.filter(Boolean);
  results.innerHTML = companies.length >= 2 ? renderComparison(companies) : '<div class="state">მინიმუმ ორი კომპანია ვერ მოიძებნა.</div>';
  history.replaceState(null, "", `?symbols=${companies.map(company => company.symbol).join(",")}`);
}

if (typeof document !== "undefined") {
  const form = document.querySelector("[data-compare-form]"), results = document.querySelector("[data-compare-results]");
  const requested = new URLSearchParams(location.search).get("symbols")?.split(",").slice(0, 4) || [];
  requested.forEach((symbol, index) => { if (form.elements.symbol[index]) form.elements.symbol[index].value = symbol; });
  form.addEventListener("submit", event => { event.preventDefault(); load(form, results); });
  load(form, results);
}
