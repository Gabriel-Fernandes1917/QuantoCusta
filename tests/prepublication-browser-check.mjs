// Serve out/ on 127.0.0.1:4173, start an isolated headless Chrome on port 9222,
// then run: node tests/prepublication-browser-check.mjs. No downloads are written.
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Reuse the real models and encoders without installing a DOM test dependency.
registerHooks({
  resolve(specifier, context, next) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      if (existsSync(`${fileURLToPath(url)}.ts`)) return next(`${url.href}.ts`, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});

const entries = [];
async function fixture(route, module, factory, storage, encode, configure, expected, blockedClear = false) {
  const model = await import(`../src/lib/calculations/${module}.ts`);
  const values = model[factory](); configure(values, model);
  const codec = await import(`../src/lib/${storage}.ts`);
  entries.push({ route, key: Object.values(codec).find(v => typeof v === "string"), json: codec[encode](values), expected, blockedClear });
}
const long = "W".repeat(80);
await fixture("calculadora-custo-de-vida", "cost-of-living", "emptySimulation", "simulation-storage", "encodeSimulation", v => Object.assign(v, { salary: 500000, rent: 200000, groceries: 30000, foodBenefits: 20000, benefitUse: 20000 }), ["2.300,00", "2.900,00"]);
await fixture("comparar-imoveis", "property-comparison", "emptyComparison", "property-storage", "encodeComparison", v => { Object.assign(v.properties[0], { name: long, main: 100000, tax: 120000 }); v.properties[1].main = 90000; }, ["1.100,00", "900,00"]);
await fixture("comer-fora-ou-cozinhar", "meal-comparison", "emptyMealRoutine", "meal-storage", "encodeMealRoutine", v => {
  Object.assign(v.meals[0], { name: long, enabled: true, frequency: 5, outside: 1200, ingredients: [{ id: "i", name: long, used: 200, usedUnit: "g", price: 1000, bought: 1000, boughtUnit: "g" }] }); v.preparation.gas = 1000;
}, ["53,33", "260,00"]);
await fixture("veiculo-proprio-ou-aplicativo", "vehicle-comparison", "emptyVehicleComparison", "vehicle-storage", "encodeVehicleComparison", v => Object.assign(v, { vehicle: "car", ownership: "owned", app: "car", fuelMonthly: 20000, insurance: 120000, rides: 10, fare: 2500 }), ["300,00", "1.083,33"], true);
await fixture("comparar-hospedagens", "lodging-comparison", "emptyLodgingComparison", "lodging-storage", "encodeLodgingComparison", (v, m) => {
  Object.assign(v, { people: 2, nights: 4, transport: "own", efficiency: 10, fuelPrice: 600 });
  Object.assign(v.lodgings[0], { name: long, price: 200000 }); v.lodgings[0].meals.breakfast.included = true; v.lodgings[0].parking.included = true;
  v.lodgings[1].price = 160000; Object.assign(v.lodgings[1].meals.breakfast, { price: 2500, days: 4 });
  const place = m.emptyTravelPlace("center"); Object.assign(place, { name: long, visits: 2 });
  Object.assign(place.journeys[0], { distance: 2, minutes: 10, parkingPaid: true, parking: 2000 }); Object.assign(place.journeys[1], { distance: 12, minutes: 30 }); v.places.push(place);
}, ["2.044,80", "1.868,80"], true);
await fixture("veiculo-alugado-ou-aplicativo", "rental-comparison", "emptyRentalComparison", "rental-storage", "encodeRentalComparison", (v, m) => {
  Object.assign(v, { days: 7, people: 2, vehicle: "car", rentalPrice: 15000, rentalDays: 7, fuelMode: "distance", kilometers: 500, efficiency: 10, fuelPrice: 600, parkingPaid: true, parkingMode: "daily", parkingPrice: 2000, parkingDays: 5, tollPaid: true, tolls: 8000, cleaning: 3000 });
  v.rides = [[1, 6000, 7000, 10, 15], [4, 2500, 3000, 8, 10], [2, 4000, 4500, 10, 10]].map(([count, outwardFare, returnFare, outwardWait, returnWait], i) => Object.assign(m.emptyRentalRide(String(i)), { name: long, kind: "round", count, outwardFare, returnFare, outwardWait, returnWait }));
}, ["1.560,00", "520,00", "2h17"], true);
const { newTripScenario, parseTripDraft } = await import("../src/lib/trip-form.ts");
const { encodeTripPlan, TRIP_STORAGE_KEY } = await import("../src/lib/trip-storage.ts");
const trip = newTripScenario("audit-trip", ""); trip.items[0].amount = "100,00";
entries.push({ route: "custo-da-viagem", key: TRIP_STORAGE_KEY, json: encodeTripPlan(parseTripDraft({ mode: "single", scenarios: [trip] })), expected: ["100,00"] });

const base = "http://127.0.0.1:4173";
const pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const ws = new WebSocket(pages.find(p => p.type === "page").webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
let id = 0; const pending = new Map(), errors = [], requests = [];
ws.onmessage = event => {
  const value = JSON.parse(event.data);
  if (value.id) { pending.get(value.id)?.(value); pending.delete(value.id); }
  else if (value.method === "Runtime.exceptionThrown") errors.push(value.params.exceptionDetails);
  else if (value.method === "Runtime.consoleAPICalled" && value.params.type === "error") errors.push(value.params.args);
  else if (value.method === "Network.requestWillBeSent") requests.push(value.params.request);
};
const call = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
const pause = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) {
  const response = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!response.result.exceptionDetails, JSON.stringify(response.result.exceptionDetails));
  return response.result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await pause(); }
  assert.fail(`Timed out: ${expression}`);
}
async function visit(route) {
  await call("Page.navigate", { url: `${base}/${route}/` });
  await until(`location.pathname === ${JSON.stringify(`/${route}/`)} && document.readyState === 'complete' && !!document.querySelector('.storage-actions button') && !document.querySelector('.storage-actions button').disabled && Object.keys(document.querySelector('.storage-actions button')).some(k=>k.startsWith('__reactProps'))`);
  const entry = entries.find(e => e.route === route);
  if (await evaluate(`!!localStorage.getItem(${JSON.stringify(entry.key)})`)) await until("[...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('carregad'))");
  await pause();
}
async function input(id, value) {
  await evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)});
    Object.getOwnPropertyDescriptor(e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)});
    e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
  await pause();
}
async function submit() { await evaluate("document.querySelector('form').requestSubmit()"); await pause(); }
function validateExcel(bytes) {
  const b = Buffer.from(bytes), files = {};
  let end = b.length - 22;
  while (b.readUInt32LE(end) !== 0x06054b50) end--;
  let pos = b.readUInt32LE(end + 16);
  for (let i = 0; i < b.readUInt16LE(end + 10); i++) {
    const len = b.readUInt16LE(pos + 28), offset = b.readUInt32LE(pos + 42);
    const name = b.subarray(pos + 46, pos + 46 + len).toString();
    const start = offset + 30 + b.readUInt16LE(offset + 26) + b.readUInt16LE(offset + 28);
    const data = b.subarray(start, start + b.readUInt32LE(pos + 20));
    files[name] = (b.readUInt16LE(pos + 10) === 8 ? inflateRawSync(data) : data).toString();
    pos += 46 + len + b.readUInt16LE(pos + 30) + b.readUInt16LE(pos + 32);
  }
  const styles = files["xl/styles.xml"];
  for (const expected of ['style="thin"', "FFDCE1E5", "FFF5F6F7", "FF164B3B", "FFFFFFFF", "wrapText", "R$"]) assert.ok(styles.includes(expected), expected);
  const sheets = Object.entries(files).filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  assert.ok(sheets.length >= 2);
  for (const [, xml] of sheets) {
    assert.ok(xml.includes('state="frozen"'));
    assert.ok(xml.includes('ySplit="1"'));
    assert.ok(xml.includes('topLeftCell="A2"'));
    assert.ok(!xml.includes("<f>"), "Reports remain snapshots without linked formulas");
  }
  return sheets.length;
}
async function exports() {
  await evaluate("window.auditBlobs=[]; URL.createObjectURL=b=>{window.auditBlobs.push(b);return 'blob:audit';}; HTMLAnchorElement.prototype.click=function(){};");
  const results = [];
  for (const kind of ["PDF", "Excel"]) {
    await evaluate(`[...document.querySelectorAll('.export-actions button')].find(b=>b.textContent.includes(${JSON.stringify(kind)})).click()`);
    await until("document.querySelector('.export-panel').getAttribute('aria-busy') === 'false'");
    const blob = await evaluate("(async()=>{const b=window.auditBlobs.at(-1);return b?{size:b.size,magic:Array.from(new Uint8Array(await b.slice(0,4).arrayBuffer()))}:null})()");
    assert.ok(blob?.size > 1000, kind);
    assert.deepEqual(blob.magic, kind === "PDF" ? [37, 80, 68, 70] : [80, 75, 3, 4]); results.push({ kind, size: blob.size, ...(kind === "Excel" ? { styledSheets: validateExcel(await evaluate("(async()=>Array.from(new Uint8Array(await window.auditBlobs.at(-1).arrayBuffer())))()")) } : {}) });
  }
  assert.equal(await evaluate("window.auditBlobs.length"), 2);
  return results;
}
await call("Runtime.enable"); await call("Network.enable");
await call("Page.navigate", { url: base }); await until("!!document.querySelector('main')");
const backup = await evaluate("Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))");
const report = [];
try {
  for (const entry of entries) {
    await evaluate(`localStorage.setItem(${JSON.stringify(entry.key)},${JSON.stringify(entry.json)})`);
    await visit(entry.route); await submit();
    const text = await evaluate("document.querySelector('.calculator-results')?.textContent"); assert.ok(text, entry.route);
    entry.expected.forEach(value => assert.ok(text.includes(value), `${entry.route}: ${value}`));
    const screens = [];
    for (const theme of ["light", "dark"]) {
      await input("site-theme", theme);
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
      // A fixed layout viewport catches overflow that mobile viewport expansion can mask.
      await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await evaluate("document.querySelectorAll('details').forEach(e=>e.open=true); window.scrollTo({left:0,behavior:'instant'})"); await pause();
      const sizes = await evaluate("({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})");
      assert.ok(sizes.scroll <= sizes.viewport + 1, `${entry.route} ${theme} @ ${width}px: ${JSON.stringify(sizes)}`); screens.push({ theme, width });
      }
    }
    const generated = await exports();
    await evaluate("[...document.querySelectorAll('.storage-actions button')].find(b=>b.textContent.includes('Salvar')).click()"); await pause();
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(entry.key)})`), entry.json);
    await visit(entry.route); await submit(); assert.ok(await evaluate("!!document.querySelector('.calculator-results')"));
    if (entry.blockedClear) {
      await evaluate("Storage.prototype.removeItem=function(){throw new DOMException('Blocked','SecurityError')}");
      await evaluate("[...document.querySelectorAll('.storage-actions button')].find(b=>b.textContent.includes('Limpar')).click()"); await pause();
      assert.equal(await evaluate("!!document.querySelector('.calculator-results')"), false);
      assert.equal(await evaluate("[...document.querySelectorAll('input:not([type=radio]):not([type=checkbox])')].some(e=>e.value!=='')"), false);
      assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(entry.key)})`), entry.json);
      assert.ok(await evaluate("document.querySelector('.calculator-notice').textContent.includes('cópia salva')"));
      await visit(entry.route); await submit(); assert.ok(await evaluate("!!document.querySelector('.calculator-results')"));
    }
    await evaluate("[...document.querySelectorAll('.storage-actions button')].find(b=>b.textContent.includes('Limpar')).click()"); await pause();
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(entry.key)})`), null);
    report.push({ route: entry.route, screens, generated, savedRestoredCleared: true, securityError: !!entry.blockedClear });
  }

  await visit("custo-da-viagem");
  await evaluate("document.querySelectorAll('input[name=trip-mode]')[1].click()"); await pause();
  await input("destination-1-tickets-0-amount", "100,00");
  await evaluate("document.querySelectorAll('[role=tab]')[1].click()"); await pause();
  const second = await evaluate("document.querySelector('[id$=\"-name\"]').id.replace(/-name$/, '')");
  await input(`${second}-days`, ""); await input(`${second}-tickets-0-amount`, "200,00"); await input(`${second}-name`, "");
  await evaluate("document.querySelectorAll('input[name=trip-mode]')[0].click()"); await pause(); await submit();
  assert.equal(await evaluate("document.querySelectorAll('.trip-summary-grid')[0].children.length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('.trip-summary-grid')[0].children[0].querySelector('h3').textContent"), "Destino 1");
  await exports();
  await evaluate("document.querySelectorAll('input[name=trip-mode]')[1].click()"); await pause(); await submit();
  await until(`document.activeElement.id === ${JSON.stringify(`${second}-days`)}`);
  assert.equal(await evaluate(`document.getElementById(${JSON.stringify(`${second}-days`)}).getAttribute('aria-invalid')`), "true");
  assert.equal(await evaluate(`document.getElementById(${JSON.stringify(`${second}-tickets-0-amount`)}).value`), "200,00");
  assert.ok(await evaluate("document.querySelector('[role=alert]').textContent.startsWith('Destino 2:')"));
  await input(`${second}-days`, "1");
  await input(`${second}-tickets-0-amount`, "-1");
  await evaluate("document.querySelectorAll('details').forEach(e=>e.open=false)"); await submit();
  await until(`document.activeElement.id === ${JSON.stringify(`${second}-tickets-0-amount`)}`);
  const invalid = await evaluate(`(()=>{const e=document.activeElement;let p=e.parentElement,closed=false;while(p){if(p.tagName==='DETAILS'&&!p.open)closed=true;p=p.parentElement;}return {invalid:e.getAttribute('aria-invalid'),description:document.getElementById(e.getAttribute('aria-describedby'))?.textContent,closed,value:e.value,top:e.getBoundingClientRect().top};})()`);
  assert.equal(invalid.invalid, "true"); assert.equal(invalid.closed, false); assert.equal(invalid.value, "-1"); assert.ok(invalid.description.includes("Destino 2:")); assert.ok(invalid.top >= 0);
  await input(`${second}-tickets-0-amount`, "200,00"); await submit();
  assert.equal(await evaluate("document.querySelectorAll('.trip-summary-grid')[0].children.length"), 2);
  // Enter/requestSubmit while a money input is focused must survive its blur formatting.
  await input(`${second}-tickets-0-amount`, "200");
  await evaluate(`document.getElementById(${JSON.stringify(`${second}-tickets-0-amount`)}).focus()`); await submit();
  assert.equal(await evaluate("document.querySelectorAll('.trip-summary-grid')[0].children.length"), 2);
  assert.equal(await evaluate(`document.getElementById(${JSON.stringify(`${second}-tickets-0-amount`)}).value`), "200,00");
  await evaluate("document.querySelectorAll('input[name=trip-mode]')[0].click()"); await pause();
  await evaluate("[...document.querySelectorAll('.storage-actions button')].find(b=>b.textContent.includes('Salvar')).click()"); await pause();
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(TRIP_STORAGE_KEY)})).values.scenarios.length`), 2);
  await evaluate("document.querySelector('.storage-actions button:last-child').click()"); await pause();
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Adicionar passeio').click()"); await pause();
  const tourId = await evaluate("[...document.querySelectorAll('.trip-item')].find(e=>e.querySelector('summary').textContent.startsWith('Novo passeio')).querySelector('[id$=\"-amount\"]').id.replace(/-amount$/, '')");
  await input(`${tourId}-amount`, "500,00"); await input(`${tourId}-quantity`, "3"); await input("destination-1-people", "2");
  assert.ok(await evaluate(`document.querySelector('label[for="${tourId}-amount"]').textContent.includes('Valor por ocorrência')`));
  await submit(); assert.ok(await evaluate("document.querySelector('.trip-results').textContent.includes('1.500,00')"));
  await input(`${tourId}-mode`, "person"); await submit();
  assert.ok(await evaluate(`document.querySelector('label[for="${tourId}-amount"]').textContent.includes('Valor por pessoa por ocorrência')`));
  assert.ok(await evaluate("document.querySelector('.trip-results').textContent.includes('3.000,00')"));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(requests.filter(r=>r.method!=="GET").length, 0);
  assert.equal(requests.filter(r=>!r.url.startsWith(base)&&!r.url.startsWith("blob:")&&!r.url.startsWith("data:")).length, 0);
  console.log(JSON.stringify({ report, tripModeErrorAndActivityRegressions: true, runtimeErrors: errors.length }));
} finally {
  // Restore test-profile data even on failure; never clear another calculator's keys.
  await call("Page.navigate", { url: base }); await pause();
  for (const entry of entries) await evaluate(`localStorage.removeItem(${JSON.stringify(entry.key)})`);
  await evaluate("localStorage.removeItem('coyler:theme:v1')");
  for (const [key, value] of Object.entries(backup)) await evaluate(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(value)})`);
  ws.close();
}
