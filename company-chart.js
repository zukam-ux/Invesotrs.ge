export function chartGeometry(points, width = 900, height = 300, pad = 28) {
  const values = points.map(point => Number(point.close)).filter(Number.isFinite);
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = index => pad + index * (width - pad * 2) / (values.length - 1);
  const y = value => pad + (max - value) * (height - pad * 2) / span;
  const line = values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  return { line, area: `${line} L${x(values.length - 1).toFixed(1)},${height - pad} L${pad},${height - pad} Z`, min, max };
}

const money = (value, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export async function loadCompanyChart(root, range = "1y") {
  const symbol = root.dataset.symbol;
  const state = root.querySelector("[data-company-chart-state]");
  root.querySelectorAll("[data-company-range]").forEach(button => { button.classList.toggle("active", button.dataset.companyRange === range); button.disabled = true; });
  state.textContent = "მონაცემები იტვირთება…";
  try {
    const response = await fetch(`/api/company-series?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`);
    if (!response.ok) throw new Error("series unavailable");
    const data = await response.json();
    const geometry = chartGeometry(data.points);
    if (!geometry) throw new Error("invalid series");
    root.querySelector("[data-company-line]").setAttribute("d", geometry.line);
    root.querySelector("[data-company-area]").setAttribute("d", geometry.area);
    root.querySelector("[data-company-min]").textContent = money(geometry.min, data.currency);
    root.querySelector("[data-company-max]").textContent = money(geometry.max, data.currency);
    const first = data.points[0].close, last = data.points.at(-1).close, change = (last - first) / first * 100;
    const changeNode = root.querySelector("[data-company-change]");
    changeNode.textContent = `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`;
    changeNode.className = change >= 0 ? "up" : "down";
    root.querySelector("[data-company-events]").innerHTML = data.events.length
      ? data.events.slice(-8).reverse().map(event => `<li><b>${event.type === "dividend" ? "დივიდენდი" : "აქციების დაყოფა"}</b><span>${event.type === "dividend" ? money(event.amount, data.currency) : `${event.numerator}:${event.denominator}`}</span><time>${new Date(event.timestamp * 1000).toLocaleDateString("ka-GE")}</time></li>`).join("")
      : "<li>არჩეულ პერიოდში დივიდენდი ან დაყოფა არ დაფიქსირდა.</li>";
    state.textContent = `წყარო: Yahoo Finance · შესაძლოა დაგვიანებული იყოს · ${new Date(data.fetchedAt).toLocaleString("ka-GE")}`;
  } catch { state.textContent = "ისტორიული მონაცემები დროებით მიუწვდომელია."; }
  finally { root.querySelectorAll("[data-company-range]").forEach(button => button.disabled = false); }
}

if (typeof document !== "undefined") document.querySelectorAll("[data-company-chart]").forEach(root => {
  root.querySelectorAll("[data-company-range]").forEach(button => button.addEventListener("click", () => loadCompanyChart(root, button.dataset.companyRange)));
  loadCompanyChart(root);
});
