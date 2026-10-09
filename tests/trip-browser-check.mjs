// Manual integration check: serve out/ on port 4173 and start headless Chrome
// with --remote-debugging-port=9222, then run node tests/trip-browser-check.mjs.
import assert from "node:assert/strict";
const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const ws = new WebSocket(pages.find(p => p.type === "page").webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
let id = 0;
const pending = new Map();
ws.onmessage = e => {
  const value = JSON.parse(e.data);
  if (value.id) { pending.get(value.id)?.(value); pending.delete(value.id); }
};
const call = (method, params = {}) => new Promise(resolve => {
  const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({id:n,method,params}));
});
const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = async expression => {
  const response = await call("Runtime.evaluate", {expression,returnByValue:true,awaitPromise:true});
  assert.ok(!response.result.exceptionDetails, JSON.stringify(response.result.exceptionDetails));
  return response.result.result.value;
};
const setInput = async (suffix, value) => {
  await evaluate(`(() => {
    const input = [...document.querySelectorAll('input')].find(e => e.id.endsWith(${JSON.stringify(suffix)}));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await pause();
};
try {
  await call("Page.navigate", {url:"http://127.0.0.1:4173/custo-da-viagem/"});
  for (let i=0; i<40; i++) { await pause(); if (await evaluate("!!document.querySelector('.trip-calculator')")) break; }
  await evaluate("document.querySelector('.storage-actions button:last-child').click()"); await pause();
  await evaluate(`(() => {
    const scroll = Element.prototype.scrollIntoView;
    window.destinationScrolls = [];
    Element.prototype.scrollIntoView = function(options) {
      if (this.id === 'trip-general-title') window.destinationScrolls.push(options.behavior);
      return scroll.call(this, options);
    };
  })()`);
  assert.equal(await evaluate("!!document.querySelector('.trip-destination-navigation')"), false);
  await evaluate("document.querySelectorAll('input[name=trip-mode]')[1].click()"); await pause();
  await setInput("-name", "Gramado"); await setInput("-food-1-amount", "28,00");
  await evaluate("document.querySelectorAll('[role=tab]')[1].click()"); await pause();
  assert.equal(await evaluate('document.activeElement.id'), 'trip-general-title');
  await setInput("-name", "Nova Petrópolis"); await setInput("-food-1-amount", "40,00");
  await evaluate(`document.querySelector('[role=tab][aria-selected=true]').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowLeft',bubbles:true}))`); await pause();
  const report = await evaluate(`({
    selected:document.querySelector('[role=tab][aria-selected=true]').textContent,
    focused:document.activeElement.textContent,
    amount:document.querySelector('[id$="-food-1-amount"]').value,
    live:document.querySelector('.trip-live-total').textContent
  })`);
  assert.equal(report.selected, "Gramado"); assert.equal(report.focused, "Gramado"); assert.equal(report.amount, "28,00");
  assert.ok(report.live.includes("28,00"));
  const navigate = async index => {
    await evaluate(`(() => {
      document.querySelectorAll('.expense-section').forEach(e => e.open = true);
      const button = document.querySelectorAll('.trip-destination-navigation button')[${index}];
      button.scrollIntoView({behavior:'instant'}); button.click();
    })()`);
    await pause(900);
    const state = await evaluate(`({focused:document.activeElement.id, selected:document.querySelector('[role=tab][aria-selected=true]').textContent, title:document.querySelector('#trip-general-title').textContent, top:document.querySelector('#trip-general-title').getBoundingClientRect().top, overflow:document.documentElement.scrollWidth>innerWidth})`);
    assert.equal(state.focused, 'trip-general-title');
    assert.equal(state.selected, state.title);
    assert.ok(state.top >= 32 && state.top < 120, JSON.stringify(state));
    assert.equal(state.overflow, false);
    return state;
  };
  assert.equal(await evaluate("document.querySelector('.trip-destination-navigation button').textContent"), 'Próximo: Nova Petrópolis →');
  await navigate(0);
  assert.equal(await evaluate("document.querySelector('[id$=\"-food-1-amount\"]').value"), '40,00');
  await navigate(0);
  assert.equal(await evaluate("document.querySelector('[id$=\"-food-1-amount\"]').value"), '28,00');
  await evaluate(`document.querySelector('[role=tab][aria-selected=true]').dispatchEvent(new KeyboardEvent('keydown', {key:'End',bubbles:true}))`); await pause();
  assert.equal(await evaluate(`document.querySelector('[id$="-food-1-amount"]').value`), "40,00");
  await evaluate("document.querySelector('form').requestSubmit()"); await pause();
  assert.equal(await evaluate("document.querySelectorAll('.trip-summary-grid')[0].children.length"), 2);
  for (let i=0; i<2; i++) {
    await navigate(1);
    await setInput("-name", `Destino ${i+3} com nome longo e personalizado para conferir a quebra em telas pequenas`);
    await setInput("-food-1-amount", "28,00");
  }
  assert.equal(await evaluate("document.querySelectorAll('.trip-destination-navigation button').length"), 1);
  await evaluate(`(() => {
    const select = document.querySelector('[id$="-food-1-mode"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'personDay');
    select.dispatchEvent(new Event('change', {bubbles:true}));
  })()`); await pause();
  await evaluate("document.querySelector('form').requestSubmit()"); await pause();
  assert.equal(await evaluate("document.querySelectorAll('.trip-summary-grid')[0].children.length"), 4);
  assert.equal(await evaluate("document.querySelector('.trip-unit-warning p').textContent"), "Atenção: alguns gastos foram calculados em unidades diferentes entre os destinos. Confira os valores antes de comparar os totais.");
  assert.equal(await evaluate("document.querySelectorAll('[role=tab][aria-selected=true]').length"), 1);
  for (const [name,width,height] of [["mobile",390,844],["desktop",1440,1000]]) {
    await call("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:name==="mobile"}); await pause();
    report[name] = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,columns:getComputedStyle(document.querySelector('.trip-summary-grid')).gridTemplateColumns})`);
    assert.equal(report[name].overflow, false);
    assert.equal(report[name].columns.split(" ").length, name === "mobile" ? 1 : 2);
    await call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await navigate(0);
    await navigate(1);
    assert.equal(await evaluate("document.querySelector('[id$=\"-food-1-amount\"]').value"), '28,00');
    assert.equal(await evaluate('window.destinationScrolls.at(-1)'), 'instant');
    await call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await navigate(0);
    await navigate(1);
    assert.equal(await evaluate('window.destinationScrolls.at(-1)'), 'smooth');
  }
  await evaluate("document.querySelectorAll('input[name=trip-mode]')[0].click()"); await pause();
  assert.equal(await evaluate("!!document.querySelector('.trip-destination-navigation')"), false);
  console.log(JSON.stringify(report));
} finally { ws.close(); }
