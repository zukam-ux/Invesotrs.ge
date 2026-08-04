(function(){
  'use strict';
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const articleHref=article=>article?.id?`/news/${encodeURIComponent(article.id)}`:'/news.html';
  const relativeTime=value=>{
    const minutes=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
    if(minutes<60)return `${Math.max(1,minutes)} წუთის წინ`;
    if(minutes<1440)return `${Math.floor(minutes/60)} საათის წინ`;
    return new Date(value).toLocaleDateString('ka-GE',{day:'numeric',month:'long'});
  };
  const signed=value=>`${Number(value)>=0?'+':'−'}${Math.abs(Number(value)||0).toFixed(2)}%`;
  function buildShell(){
    document.body.classList.add('editorial-cover');
    const search=document.querySelector('header .search');
    if(search&&!document.querySelector('.editorial-date')){
      const date=document.createElement('div'); date.className='editorial-date';
      date.innerHTML=`<strong>${new Intl.DateTimeFormat('ka-GE',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</strong>თბილისი · ქართული ფინანსური გამოცემა`;
      search.insertAdjacentElement('afterend',date);
    }
    const main=document.querySelector('main'); if(!main)return;
    main.innerHTML=`<span class="date" hidden aria-hidden="true"></span>
      <section class="ec-pulse" aria-label="ბაზრების მოკლე მიმოხილვა"><div class="ec-shell ec-pulse-inner" id="ecPulse">
        ${['BITCOIN','NASDAQ 100','S&P 500','GOLD','USD / GEL','ETHEREUM'].map((label,index)=>`<div class="ec-quote"><span class="ec-quote-label">${label}</span><strong class="ec-quote-value" data-quote-value="${index}">—</strong><span class="ec-quote-change" data-quote-change="${index}">იტვირთება</span></div>`).join('')}
      </div></section>
      <section class="ec-shell ec-lead" id="ecLead"><div class="ec-loading">მთავარი ამბავი იტვირთება…</div></section>
      <section class="ec-shell ec-news"><div class="ec-section-head"><div><span class="ec-kicker">მუდმივად განახლებადი</span><h2 class="ec-section-title">ბოლო ამბები</h2></div><a class="ec-section-link" href="/news.html">ყველა სიახლე →</a></div><div class="ec-news-list" id="ecNews"><div class="ec-loading">სიახლეები იტვირთება…</div></div></section>
      <section class="ec-shell ec-lower">
        <div class="ec-column"><span class="ec-kicker">ცოცხალი მონაცემები</span><h2>ბაზრების კომპასი</h2><table class="ec-table" aria-label="ბაზრის ფასები"><tbody id="ecCompass"><tr><td colspan="3">მონაცემები იტვირთება…</td></tr></tbody></table></div>
        <div class="ec-column"><span class="ec-kicker">პრაქტიკული</span><h2>ინვესტორის ხელსაწყოები</h2><a class="ec-link-card" href="/tools.html"><strong>რთული პროცენტის კალკულატორი →</strong><span>ნახე, როგორ მუშაობს დრო და რეგულარული შენატანი.</span></a><a class="ec-link-card" href="/compare.html"><strong>აქტივების შედარება →</strong><span>შეადარე აქციები, ETF-ები და კრიპტოაქტივები.</span></a><a class="ec-link-card" href="/markets.html"><strong>ბაზრის ძიება →</strong><span>იპოვე კომპანია, ინდექსი ან აქტივი.</span></a></div>
        <div class="ec-column"><span class="ec-kicker">სწავლისთვის</span><h2>ინვესტირების გზამკვლევი</h2><a class="ec-link-card" href="/learn.html"><strong>საიდან დავიწყო? →</strong><span>საბაზისო ცნებები და ნაბიჯები ახალი ინვესტორისთვის.</span></a><a class="ec-link-card" href="/learning.html"><strong>რისკი და დივერსიფიკაცია →</strong><span>როგორ შეაფასო რყევა და არ დაეყრდნო ერთ აქტივს.</span></a><a class="ec-link-card" href="/news.html"><strong>ახალი ამბების კითხვა →</strong><span>წყარო, კონტექსტი და ქართული შეჯამება ერთ სივრცეში.</span></a></div>
      </section>
      <section class="ec-trust"><div class="ec-shell ec-trust-inner"><h2>ფაქტი, წყარო,<br>კონტექსტი.</h2><div><strong>წყაროს გამჭვირვალობა</strong><p>ყველა ამბავს ახლავს პირველწყარო და გამოქვეყნების დრო.</p></div><div><strong>ქართული რედაქცია</strong><p>სათაურები და შეჯამებები ითარგმნება ქართულად და მონიშნულია როგორც AI-assisted.</p></div><div><strong>პასუხისმგებლიანი გამოყენება</strong><p>მასალა საინფორმაციოა და არ წარმოადგენს ინდივიდუალურ ფინანსურ რჩევას.</p></div></div></section>
      <footer class="ec-footer"><div class="ec-shell ec-footer-inner"><strong>Investors.ge · ქართული საინვესტიციო მედია</strong><nav><a href="/news.html">სიახლეები</a><a href="/markets.html">ბაზრები</a><a href="/learn.html">სწავლა</a><a href="/tools.html">ხელსაწყოები</a></nav><span>© ${new Date().getFullYear()} Investors.ge</span></div></footer>`;
  }
  async function loadNews(){
    try{
      const response=await fetch('/data/global-news.json',{cache:'no-store'}); if(!response.ok)throw new Error('news unavailable');
      const payload=await response.json(); const articles=(Array.isArray(payload)?payload:(payload.articles||payload.items||[])).filter(item=>item?.id&&item?.titleKa).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
      if(!articles.length)throw new Error('no articles'); const lead=articles[0];
      document.getElementById('ecLead').innerHTML=`
        <article class="ec-lead-copy"><span class="ec-kicker">დღის მთავარი ამბავი · ${escapeHtml(lead.category||'ბაზრები')}</span><h1><a href="${articleHref(lead)}">${escapeHtml(lead.titleKa)}</a></h1><p class="ec-deck">${escapeHtml(lead.summaryKa||'წაიკითხე ამბის ქართული მიმოხილვა, მთავარი ფაქტები და პირველწყარო.')}</p><div class="ec-byline"><strong>${escapeHtml(lead.source||'საერთაშორისო მედია')}</strong><span>${relativeTime(lead.publishedAt)}</span><a class="ec-read" href="${articleHref(lead)}">წაიკითხე ქართულად →</a></div></article>
        <figure class="ec-photo"><img src="/assets/home-editorial-georgia.jpg" alt="თბილისის ფინანსური და საზოგადოებრივი არქიტექტურა" width="860" height="1075"><figcaption>საილუსტრაციო ფოტო · Investors.ge-ის სარედაქციო ვიზუალი</figcaption></figure>
        <aside class="ec-why"><span class="ec-kicker">რატომ არის მნიშვნელოვანი</span><h2>ამბავი მოკლედ</h2><ol><li>${escapeHtml(lead.summaryKa||'მთავარი ფაქტები წარმოდგენილია ქართულად.')}</li><li>მასალა ეფუძნება ${escapeHtml(lead.source||'მითითებულ საერთაშორისო წყაროს')} და ინარჩუნებს პირველწყაროს ბმულს.</li><li>გადაამოწმე სრული კონტექსტი ქართულ გვერდზე გადაწყვეტილების მიღებამდე.</li></ol></aside>`;
      document.getElementById('ecNews').innerHTML=articles.slice(1,7).map(article=>`<a class="ec-news-row" href="${articleHref(article)}"><time class="ec-news-time" datetime="${escapeHtml(article.publishedAt)}">${relativeTime(article.publishedAt)}</time><h3>${escapeHtml(article.titleKa)}</h3><div class="ec-news-meta">${escapeHtml(article.source||'წყარო')}<br>${escapeHtml(article.category||'სიახლე')}</div></a>`).join('');
    }catch(_){document.getElementById('ecLead').innerHTML='<div class="ec-loading">მთავარი ამბის ჩატვირთვა დროებით შეფერხებულია.</div>';document.getElementById('ecNews').innerHTML='<div class="ec-loading">სიახლეების ჩატვირთვა დროებით შეფერხებულია.</div>'}
  }
  function setQuote(index,value,change){const valueNode=document.querySelector(`[data-quote-value="${index}"]`),changeNode=document.querySelector(`[data-quote-change="${index}"]`);if(!valueNode||!changeNode)return;valueNode.textContent=value;changeNode.textContent=change;const number=parseFloat(String(change).replace('−','-'));changeNode.className='ec-quote-change '+(number>=0?'ec-positive':'ec-negative')}
  async function loadMarkets(){
    try{
      const [marketResult,quoteResult]=await Promise.allSettled([fetch('/api/market-data').then(r=>r.ok?r.json():Promise.reject()),fetch('/api/news-quotes?symbols=QQQ,%5EGSPC,GC%3DF').then(r=>r.ok?r.json():Promise.reject())]);
      const market=marketResult.status==='fulfilled'?marketResult.value:{}; const rows=quoteResult.status==='fulfilled'?(quoteResult.value.quotes||quoteResult.value.data||quoteResult.value):[]; const list=Array.isArray(rows)?rows:Object.values(rows||{}); const find=symbol=>list.find(row=>row.symbol===symbol)||{};
      const btc=market.crypto?.bitcoin||{},eth=market.crypto?.ethereum||{},usd=market.fx?.usd||{},qqq=find('QQQ'),sp=find('^GSPC'),gold=find('GC=F');
      setQuote(0,btc.usd?'$'+Number(btc.usd).toLocaleString('en-US',{maximumFractionDigits:0}):'—',signed(btc.usd_24h_change));setQuote(1,qqq.price?'$'+Number(qqq.price).toFixed(2):'—',signed(qqq.changePercent));setQuote(2,sp.price?Number(sp.price).toLocaleString('en-US',{maximumFractionDigits:2}):'—',signed(sp.changePercent));setQuote(3,gold.price?'$'+Number(gold.price).toLocaleString('en-US',{maximumFractionDigits:1}):'—',signed(gold.changePercent));setQuote(4,usd.rate?Number(usd.rate).toFixed(4):'—',`${Number(usd.diff||0)>=0?'+':'−'}${Math.abs(Number(usd.diff||0)).toFixed(4)}`);setQuote(5,eth.usd?'$'+Number(eth.usd).toLocaleString('en-US',{maximumFractionDigits:0}):'—',signed(eth.usd_24h_change));
      const compass=[['S&P 500',sp.price?Number(sp.price).toLocaleString('en-US',{maximumFractionDigits:2}):'—',signed(sp.changePercent)],['NASDAQ 100',qqq.price?'$'+Number(qqq.price).toFixed(2):'—',signed(qqq.changePercent)],['Bitcoin',btc.usd?'$'+Number(btc.usd).toLocaleString('en-US',{maximumFractionDigits:0}):'—',signed(btc.usd_24h_change)],['USD / GEL',usd.rate?Number(usd.rate).toFixed(4):'—','NBG'],['Gold',gold.price?'$'+Number(gold.price).toLocaleString('en-US',{maximumFractionDigits:1}):'—',signed(gold.changePercent)]];
      document.getElementById('ecCompass').innerHTML=compass.map(row=>`<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`).join('');
    }catch(_){document.querySelectorAll('.ec-quote-change').forEach(node=>node.textContent='მიუწვდომელია');document.getElementById('ecCompass').innerHTML='<tr><td colspan="3">მონაცემების განახლება დროებით შეფერხებულია.</td></tr>'}
  }
  function start(){buildShell();loadNews();loadMarkets();setInterval(loadNews,300000);setInterval(loadMarkets,60000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0));else setTimeout(start,0);
})();
