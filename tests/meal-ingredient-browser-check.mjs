// Serve out/ on port 4173 and start isolated headless Chrome with CDP on 9222.
import assert from "node:assert/strict";
const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const ws = new WebSocket(pages.find(p => p.type === "page").webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
let id = 0;
const pending = new Map();
ws.onmessage = e => { const v = JSON.parse(e.data); if (v.id) { pending.get(v.id)?.(v); pending.delete(v.id); } };
const call = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
const pause = () => new Promise(resolve => setTimeout(resolve, 150));
async function evaluate(expression) {
  const response = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!response.error && !response.result.exceptionDetails, JSON.stringify(response));
  return response.result.result.value;
}
async function set(suffix, value, select = false) {
  await evaluate(`(() => { const e = document.querySelector('[id$="${suffix}"]'); Object.getOwnPropertyDescriptor(${select ? "HTMLSelectElement" : "HTMLInputElement"}.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('${select ? "change" : "input"}', {bubbles:true})); })()`);
  await pause();
}
try {
  await call("Page.navigate", { url: "http://127.0.0.1:4173/comer-fora-ou-cozinhar/" });
  for (let i = 0; i < 60; i++) { await pause(); if (await evaluate("!!document.querySelector('.storage-actions button:not(:disabled)')")) break; }
  await evaluate("document.querySelector('.storage-actions button:last-child').click()"); await pause();
  await evaluate("document.querySelector('.meal-section').open = true; document.querySelector('[id$=\"-items\"]').click()"); await pause();
  await set("-frequency", "7"); await set("-outside", "30");
  await set("-used", "200"); await set("-price", "27"); await set("-bought", "1,5");
  await set("-bought-unit", "kg", true);
  assert.equal(await evaluate("document.querySelector('[id$=\"-bought\"]').value"), "1,5");
  await evaluate("document.querySelector('form').requestSubmit()"); await pause();
  assert.ok(await evaluate("document.querySelector('.meal-results').textContent.includes('R$ 3,60')"));
  // Compatible units still convert; changing the unit alone preserves the numeric draft.
  await set("-bought-unit", "g", true);
  assert.equal(await evaluate("document.querySelector('[id$=\"-bought\"]').value"), "1,5");
  await set("-bought", "1500");
  await evaluate("document.querySelector('form').requestSubmit()"); await pause();
  assert.ok(await evaluate("document.querySelector('.meal-results').textContent.includes('R$ 3,60')"));
  await set("-used-unit", "ml", true); await set("-bought-unit", "L", true);
  assert.equal(await evaluate("document.querySelector('[id$=\"-bought\"]').value"), "1500");
  await set("-bought", "1,5");
  await evaluate("document.querySelector('form').requestSubmit()"); await pause();
  assert.ok(await evaluate("document.querySelector('.meal-results').textContent.includes('R$ 3,60')"));
  await set("-used-unit", "unit", true); await set("-used", "2"); await set("-bought", "10");
  await evaluate("document.querySelector('form').requestSubmit()"); await pause();
  assert.ok(await evaluate("document.querySelector('.meal-results').textContent.includes('R$ 5,40')"));
  for (const width of [1440, 390, 320]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    for (const theme of ["light", "dark"]) {
      await evaluate(`document.documentElement.dataset.theme = '${theme}'`);
      const layout = await evaluate(`(() => {
        const q = document.querySelector('.meal-purchased-quantity'), p = q.previousElementSibling;
        const input = q.querySelector('input'), select = q.querySelector('select');
        const r = select.getBoundingClientRect(), i = input.getBoundingClientRect(), box = q.querySelector('.money-control').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, overlap: i.right > r.left, contained: r.right <= box.right && r.left >= box.left, sameRow: Math.abs(q.getBoundingClientRect().top-p.getBoundingClientRect().top)<2, scheme:getComputedStyle(select).colorScheme, color:getComputedStyle(select).color, background:getComputedStyle(select).backgroundColor, inputWidth:i.width };
      })()`);
      assert.equal(layout.overflow, false, JSON.stringify({ width, theme, layout }));
      assert.equal(layout.overlap, false); assert.equal(layout.contained, true);
      assert.equal(layout.sameRow, width >= 600); assert.equal(layout.scheme, theme);
      assert.notEqual(layout.color, layout.background); assert.ok(layout.inputWidth > 50);
      console.log(`OK: ${width}px, ${theme}, quantidade e unidade sem sobreposição`);
    }
  }
  console.log("OK: decimais, inteiros, g/kg, ml/L, unidade, conversões e preservação dos dados");
} finally { ws.close(); }
