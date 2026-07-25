export const RANGE_LABELS = Object.freeze({
  "1d": "ბოლო 1 დღე",
  "1w": "ბოლო 1 კვირა",
  "1m": "ბოლო 1 თვე",
  "3m": "ბოლო 3 თვე",
  "1y": "ბოლო 1 წელი",
});

export function calculateChange(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const start = Number(points[0].close);
  const latest = Number(points.at(-1).close);
  if (!Number.isFinite(start) || !Number.isFinite(latest) || start === 0) return null;
  return { start, latest, value: latest - start, percent: ((latest - start) / start) * 100 };
}

export function buildChartGeometry(points, width = 900, height = 330, padding = 34) {
  const values = points.map((point) => Number(point.close)).filter(Number.isFinite);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index) => padding + (index * (width - padding * 2)) / (values.length - 1);
  const y = (value) => padding + ((max - value) * (height - padding * 2)) / span;
  const line = values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(2)},${height - padding} L${padding},${height - padding} Z`;
  return { line, area, min, max };
}

const money = (value, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const date = (timestamp) =>
  new Date(timestamp * 1000).toLocaleDateString("ka-GE", { day: "numeric", month: "short", year: "numeric" });
const time = (value) =>
  new Date(value).toLocaleString("ka-GE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export async function loadMarketChart(root, range = "1m") {
  const buttons = [...root.querySelectorAll("[data-chart-range]")];
  const state = root.querySelector("[data-chart-state]");
  buttons.forEach((button) => {
    const active = button.dataset.chartRange === range;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = true;
  });
  state.textContent = "მონაცემები იტვირთება…";
  root.classList.add("is-loading");
  root.classList.remove("has-error");

  try {
    const response = await fetch(`/api/market-series?range=${encodeURIComponent(range)}`);
    if (!response.ok) throw new Error("Market series unavailable");
    const data = await response.json();
    const change = calculateChange(data.points);
    const geometry = buildChartGeometry(data.points);
    if (!change || !geometry) throw new Error("Invalid market series");

    const positive = change.value >= 0;
    root.classList.toggle("is-positive", positive);
    root.classList.toggle("is-negative", !positive);
    root.querySelector("[data-chart-line]").setAttribute("d", geometry.line);
    root.querySelector("[data-chart-area]").setAttribute("d", geometry.area);
    root.querySelector("[data-chart-latest]").textContent = money(change.latest, data.currency);
    const changeNode = root.querySelector("[data-chart-change]");
    changeNode.textContent = `${positive ? "+" : "−"}${Math.abs(change.percent).toFixed(2)}%`;
    root.querySelector("[data-chart-start]").textContent = money(change.start, data.currency);
    root.querySelector("[data-chart-min]").textContent = money(geometry.min, data.currency);
    root.querySelector("[data-chart-max]").textContent = money(geometry.max, data.currency);
    root.querySelector("[data-chart-from]").textContent = date(data.points[0].timestamp);
    root.querySelector("[data-chart-to]").textContent = date(data.points.at(-1).timestamp);
    root.querySelector("[data-chart-period]").textContent = data.rangeLabel || RANGE_LABELS[range];
    root.querySelector("[data-chart-updated]").textContent = `განახლდა: ${time(data.fetchedAt)}`;
    const svg = root.querySelector("svg");
    svg.setAttribute(
      "aria-label",
      `SPY ETF, ${data.rangeLabel}: ${money(change.start, data.currency)}-დან ${money(change.latest, data.currency)}-მდე, ცვლილება ${change.percent.toFixed(2)} პროცენტი`,
    );
    state.textContent = "";
    root.classList.remove("is-loading");
  } catch {
    root.classList.remove("is-loading");
    root.classList.add("has-error");
    state.textContent = "მონაცემები დროებით მიუწვდომელია — მცდარი გრაფიკი არ ნაჩვენებია.";
  } finally {
    buttons.forEach((button) => (button.disabled = false));
  }
}

if (typeof document !== "undefined") {
  document.querySelectorAll("[data-market-chart]").forEach((root) => {
    root.querySelectorAll("[data-chart-range]").forEach((button) => {
      button.addEventListener("click", () => loadMarketChart(root, button.dataset.chartRange));
    });
    loadMarketChart(root);
  });
}
