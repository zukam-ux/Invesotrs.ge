const tickerMarkup=`
  <span>S&amp;P 500 <b>TradingView</b></span>
  <span>NASDAQ-100 ETF <b>QQQ · TradingView</b></span>
  <span>BITCOIN <b data-live="btc">იტვირთება…</b> <i data-live="btc-change" style="font-style:normal"></i></span>
  <span>USD/GEL <b data-live="usd">იტვირთება…</b> <i data-live="usd-date" style="font-style:normal"></i></span>
  <span><i style="font-style:normal;color:#9eb9ac">კრიპტო: CoinGecko · კურსი: NBG</i></span>`;
document.querySelectorAll('[data-ticker]').forEach(el=>el.innerHTML=tickerMarkup);
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());

async function sharedMarketData(){
  try{
    const response=await fetch('/.netlify/functions/market-data');
    if(!response.ok)throw new Error('server feed unavailable');
    return await response.json();
  }catch(_){
    const [crypto,fx]=await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true').then(r=>r.json()),
      fetch('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/json/').then(r=>r.json())
    ]);
    return {crypto:{bitcoin:crypto.bitcoin},fx:{usd:fx?.[0]?.currencies?.find(c=>c.code==='USD')}};
  }
}
async function updateSharedTicker(){
  try{
    const data=await sharedMarketData(),btc=data.crypto?.bitcoin,usd=data.fx?.usd;
    document.querySelectorAll('[data-live="btc"]').forEach(e=>e.textContent=btc?.usd?'$'+Number(btc.usd).toLocaleString('en-US'):'მიუწვდომელია');
    document.querySelectorAll('[data-live="btc-change"]').forEach(e=>{const v=btc?.usd_24h_change;e.textContent=Number.isFinite(v)?`${v>=0?'+':'−'}${Math.abs(v).toFixed(2)}%`:'';e.className=v>=0?'up':'down'});
    document.querySelectorAll('[data-live="usd"]').forEach(e=>e.textContent=usd?.rate?Number(usd.rate).toFixed(4):'მიუწვდომელია');
    document.querySelectorAll('[data-live="usd-date"]').forEach(e=>e.textContent=usd?.validFromDate?'NBG · '+new Date(usd.validFromDate).toLocaleDateString('ka-GE'):'');
  }catch(_){
    document.querySelectorAll('[data-live="btc"],[data-live="usd"]').forEach(e=>e.textContent='განახლება შეფერხებულია');
  }
}
updateSharedTicker();

function escapeNews(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function relativeNewsTime(value){
  const hours=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/36e5));
  if(hours<1)return "ბოლო საათში";
  if(hours<24)return `${hours} საათის წინ`;
  return new Date(value).toLocaleDateString("ka-GE");
}
async function loadGlobalNews(){
  const targets=document.querySelectorAll("[data-global-news]");
  if(!targets.length)return;
  try{
    const response=await fetch(`/data/global-news.json?v=${Math.floor(Date.now()/36e5)}`);
    if(!response.ok)throw new Error("news unavailable");
    const data=await response.json();
    targets.forEach(target=>{
      const limit=Number(target.dataset.limit||9),articles=(data.articles||[]).slice(0,limit);
      target.innerHTML=articles.length?articles.map(article=>`
        <a class="auto-news-card" href="${escapeNews(article.url)}" target="_blank" rel="noopener">
          <span class="badge">${escapeNews(article.category)} · ${escapeNews(article.source)}</span>
          <h3>${escapeNews(article.titleKa)}</h3>
          <p>${escapeNews(article.summaryKa)}</p>
          <span class="meta">${relativeNewsTime(article.publishedAt)} · <span class="translation-label">AI თარგმანი</span> · პირველწყარო ↗</span>
        </a>`).join(""):'<div class="news-status">პირველი ავტომატური განახლება მზადდება. გლობალური ამბები საათში ერთხელ განახლდება.</div>';
    });
    document.querySelectorAll("[data-news-updated]").forEach(el=>el.textContent=data.updatedAt?`განახლდა ${new Date(data.updatedAt).toLocaleString("ka-GE")}`:"პირველი განახლება მზადდება");
  }catch(_){
    targets.forEach(target=>target.innerHTML='<div class="news-status">გლობალური ამბების განახლება დროებით შეფერხებულია. ბაზრის მონაცემები მუშაობას აგრძელებს.</div>');
  }
}
loadGlobalNews();

document.querySelectorAll(".nav-search:not([data-asset-search])").forEach(input => {
  input.dataset.assetSearch = "";
  input.placeholder = "კომპანია, ტიკერი, კრიპტო…";
  if (!input.closest(".asset-search")) {
    const wrapper = document.createElement("label");
    wrapper.className = "asset-search";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const results = document.createElement("div");
    results.className = "asset-search-results";
    wrapper.appendChild(results);
  }
});
const assetSearchScript = document.createElement("script");
assetSearchScript.src = "asset-search.js";
document.body.appendChild(assetSearchScript);
