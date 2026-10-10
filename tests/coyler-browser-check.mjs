// Production integration: serve out/ on port 4173, isolated Chrome CDP on 9222.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const base = "http://127.0.0.1:4173", canonical = "https://coyler.com.br";
const routes = ["/", "/privacidade/", "/calculadora-custo-de-vida/", "/comparar-imoveis/", "/comer-fora-ou-cozinhar/", "/veiculo-proprio-ou-aplicativo/", "/comparar-hospedagens/", "/veiculo-alugado-ou-aplicativo/", "/custo-da-viagem/"];
const chunks = readdirSync("out/_next/static/chunks").filter(f => f.endsWith(".js")).map(file => ({ file, gzip: gzipSync(readFileSync(`out/_next/static/chunks/${file}`)).length })).sort((a, b) => b.gzip - a.gzip);
const pdfChunk = chunks[0].file;
const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const ws = new WebSocket(pages.find(p => p.type === "page").webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
let id = 0; const pending = new Map(), errors = [];
ws.onmessage = event => {
  const value = JSON.parse(event.data);
  if (value.id) { pending.get(value.id)?.(value); pending.delete(value.id); }
  else if (value.method === "Runtime.exceptionThrown") errors.push(value.params.exceptionDetails);
  else if (value.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(value.params.type)) errors.push(value.params.args);
};
const call = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
const pause = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) {
  const response = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!response.result.exceptionDetails, JSON.stringify(response.result.exceptionDetails));
  return response.result.result.value;
}
async function until(expression) { for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await pause(); } assert.fail(expression); }
async function visit(path) {
  await call("Page.navigate", { url: base + path });
  await until(`location.pathname === ${JSON.stringify(path)} && document.readyState==='complete' && !!document.querySelector('#site-theme') && Object.keys(document.querySelector('#site-theme')).some(k=>k.startsWith('__reactProps'))`);
  await pause();
}
async function theme(value) {
  await evaluate(`(()=>{const e=document.querySelector('#site-theme');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await pause();
}
await call("Runtime.enable");
await call("Page.enable");
await call("Page.addScriptToEvaluateOnNewDocument", { source: `
window.coylerVitals={lcp:null,cls:0};
new PerformanceObserver(list=>{const entries=list.getEntries();window.coylerVitals.lcp=entries.at(-1)?.startTime}).observe({type:'largest-contentful-paint',buffered:true});
new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.coylerVitals.cls+=e.value}).observe({type:'layout-shift',buffered:true});
function firstFrame(){if(document.querySelector('.site-header'))window.coylerFirstFrame={theme:document.documentElement.dataset.theme,background:getComputedStyle(document.body).backgroundColor};else requestAnimationFrame(firstFrame)}requestAnimationFrame(firstFrame);
` });
await visit("/");
const savedTheme = await evaluate("localStorage.getItem('coyler:theme:v1')");
const report = [], links = new Set();
try {
  await evaluate("localStorage.removeItem('coyler:theme:v1')");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await visit("/");
  assert.equal(await evaluate("document.documentElement.dataset.theme"), "dark");
  assert.equal(await evaluate("document.querySelector('#site-theme').value"), "system");
  assert.equal(await evaluate("localStorage.getItem('coyler:theme:v1')"), null);
  await until("!!window.coylerFirstFrame");
  assert.equal(await evaluate("window.coylerFirstFrame.theme"), "dark");
  assert.equal(await evaluate("window.coylerFirstFrame.background"), "rgb(17, 27, 22)");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await until("document.documentElement.dataset.theme==='light'");
  await theme("dark"); await visit("/");
  assert.equal(await evaluate("window.coylerFirstFrame.theme"), "dark");
  assert.equal(await evaluate("document.querySelector('#site-theme').value"), "dark");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await theme("light"); await visit("/");
  assert.equal(await evaluate("window.coylerFirstFrame.theme"), "light");
  assert.equal(await evaluate("window.coylerFirstFrame.background"), "rgb(255, 253, 247)");
  await theme("system"); await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await until("document.documentElement.dataset.theme==='light'");
  await evaluate("document.querySelector('#site-theme').focus()");
  for (const [key, code, value] of [["Home", 36, "light"], ["ArrowDown", 40, "dark"], ["End", 35, "system"]]) {
    await call("Input.dispatchKeyEvent", { type: "keyDown", key, windowsVirtualKeyCode: code });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key, windowsVirtualKeyCode: code }); await pause();
    assert.equal(await evaluate("document.querySelector('#site-theme').value"), value);
  }
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#site-theme')).outlineStyle"), "solid");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await evaluate("getComputedStyle(document.documentElement).scrollBehavior"), "auto");
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await evaluate("Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError')}"); await theme("dark");
  assert.equal(await evaluate("document.documentElement.dataset.theme"), "dark");
  assert.ok(await evaluate("document.querySelector('#theme-notice').textContent.includes('não permitiu salvar')"));

  for (const route of routes) {
    await visit(route);
    const metadata = await evaluate(`(()=>({title:document.title,description:document.querySelector('meta[name=description]')?.content,canonical:document.querySelector('link[rel=canonical]')?.href,og:document.querySelector('meta[property="og:url"]')?.content,twitter:document.querySelector('meta[name="twitter:title"]')?.content,h1:document.querySelectorAll('h1').length,schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent)),unlabelled:[...document.querySelectorAll('input,select')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).map(e=>e.id),links:[...document.querySelectorAll('a[href]')].map(e=>e.getAttribute('href')),body:document.body.textContent}))()`);
    assert.equal(metadata.h1, 1); assert.ok(metadata.title.includes("Coyler")); assert.ok(metadata.description.length > 30); assert.ok(metadata.twitter.includes("Coyler"));
    assert.equal(metadata.canonical, canonical + route); assert.equal(metadata.og, canonical + route); assert.deepEqual(metadata.unlabelled, []);
    assert.ok(!metadata.body.includes("QuantoCusta"));
    if (route === "/") {
      assert.equal(await evaluate("document.querySelector('h1').textContent"), "O menor preço nem sempre é o menor custo.");
      assert.equal(await evaluate("document.querySelector('.hero-description').textContent"), "Enxergue além do preço. Compare todos os custos envolvidos em suas escolhas e descubra o que realmente compensa para você.");
      assert.equal(metadata.schemas[0]["@type"], "WebSite");
    } else if (route !== "/privacidade/") {
      assert.equal(metadata.schemas[0]["@type"], "WebApplication"); assert.equal(metadata.schemas[0].url, canonical + route);
      assert.ok(await evaluate("document.querySelector('.related-tools a')?.getAttribute('href')"));
    }
    metadata.links.filter(link => link.startsWith("/") || link.startsWith("#")).forEach(link => links.add(new URL(link, base + route).href));
    const checks = [];
    for (const preference of ["light", "dark"]) {
      await theme(preference);
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
        await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
        await evaluate("document.querySelectorAll('details').forEach(e=>e.open=true);window.scrollTo({left:0,behavior:'instant'})"); await pause(50);
        const sizes = await evaluate("({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})");
        assert.ok(sizes.scroll <= sizes.viewport + 1, `${route} ${preference} ${width}: ${JSON.stringify(sizes)}`);
      }
      const contrast = await evaluate(`(()=>{
        const rgb=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number);
        const lum=c=>{const a=c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*a[0]+.7152*a[1]+.0722*a[2]};
        const failures=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
        while(node=walker.nextNode()){
          const e=node.parentElement;if(!node.textContent.trim()||!e||e.closest('[aria-hidden=true],script,style,option,select,button:disabled')||!e.getClientRects().length)continue;
          const s=getComputedStyle(e);if(s.visibility==='hidden'||s.opacity==='0')continue;let parent=e,bg;
          while(parent){const b=getComputedStyle(parent).backgroundColor;if(b!=='rgba(0, 0, 0, 0)'&&b!=='transparent'){bg=b;break;}parent=parent.parentElement;}
          if(!bg)bg=getComputedStyle(document.body).backgroundColor;
          const a=lum(rgb(s.color)),b=lum(rgb(bg)),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
          const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&parseFloat(s.fontWeight)>=700);
          if(ratio<(large?3:4.5))failures.push({tag:e.tagName,cls:e.className,text:node.textContent.slice(0,60),ratio});
        }return failures;
      })()`);
      assert.deepEqual(contrast, [], `${route} ${preference}: ${JSON.stringify(contrast)}`); checks.push(preference);
    }
    const html = readFileSync(`out${route}index.html`, "utf8");
    assert.ok(!html.includes("localhost:3000")); assert.ok(!html.includes("QuantoCusta"));
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].filter(m => !m[0].includes("noModule"));
    const js = scripts.reduce((sum, m) => sum + gzipSync(readFileSync(`out${m[1]}`)).length, 0);
    await evaluate("document.body.style.zoom='2'"); await pause();
    const zoom = await evaluate("({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})");
    assert.ok(zoom.scroll <= zoom.viewport + 1, `${route} zoom 200%: ${JSON.stringify(zoom)}`);
    await evaluate("document.body.style.zoom=''");
    report.push({ route, themes: checks, initialJSGzipKiB: Math.round(js / 1024), localVitals: await evaluate("window.coylerVitals") });
  }
  for (const link of links) {
    const url = new URL(link), response = await fetch(url); assert.equal(response.status, 200, link);
    if (url.hash) assert.ok((await response.text()).includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), link);
  }
  const sitemap = readFileSync("out/sitemap.xml", "utf8"); routes.forEach(route => assert.ok(sitemap.includes(canonical + route)));
  assert.ok(!sitemap.includes("lastmod")); assert.ok(readFileSync("out/robots.txt", "utf8").includes(canonical + "/sitemap.xml"));
  const notFound = readFileSync("out/404.html", "utf8");
  assert.ok(notFound.includes("noindex")); assert.ok(notFound.includes("Página não encontrada"));
  assert.equal((await fetch(base + "/rota-inexistente/")).status, 404);
  for (const path of ["/og-image.png", "/icon.svg", "/icon-32.png", "/apple-touch-icon.png"]) assert.equal((await fetch(base + path)).status, 200, path);

  await visit("/comparar-imoveis/"); await evaluate("document.querySelector('form').requestSubmit()"); await until("!!document.querySelector('.export-panel')");
  await evaluate("window.testBlobs=[];URL.createObjectURL=b=>{window.testBlobs.push(b);return 'blob:test'};HTMLAnchorElement.prototype.click=function(){}");
  await evaluate("[...document.querySelectorAll('.export-actions button')].find(e=>e.textContent.includes('Excel')).click()");
  await until("document.querySelector('.export-panel').getAttribute('aria-busy')==='false'"); assert.equal(await evaluate("window.testBlobs.length"), 1);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').some(e=>e.name.includes(${JSON.stringify(pdfChunk)}))`), false, "Excel must not load PDF library");
  await evaluate("[...document.querySelectorAll('.export-actions button')].find(e=>e.textContent.includes('PDF')).click()");
  await until("document.querySelector('.export-panel').getAttribute('aria-busy')==='false'"); assert.equal(await evaluate("window.testBlobs.length"), 2);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').some(e=>e.name.includes(${JSON.stringify(pdfChunk)}))`), true);

  await visit("/"); await theme("dark");
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("window.scrollTo({top:0,behavior:'instant'})"); await pause();
  const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(".next/coyler-dark-review.png", Buffer.from(screenshot.result.data, "base64"));
  await theme("light"); const light = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(".next/coyler-light-review.png", Buffer.from(light.result.data, "base64"));
  assert.deepEqual(errors, [], JSON.stringify(errors));
  console.log(JSON.stringify({ report, themePersistenceAndFirstFrame: true, brokenLinks: 0, excelDoesNotLoadPdf: true, hydrationErrors: errors.length, largestPdfChunkGzipKiB: Math.round(chunks[0].gzip / 1024) }));
} finally {
  await visit("/");
  if (savedTheme === null) await evaluate("localStorage.removeItem('coyler:theme:v1')");
  else await evaluate(`localStorage.setItem('coyler:theme:v1',${JSON.stringify(savedTheme)})`);
  ws.close();
}
