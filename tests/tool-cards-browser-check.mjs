import assert from "node:assert/strict";
const base="http://127.0.0.1:4173";
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

const expected = ["/calculadora-custo-de-vida/", "/comparar-imoveis/", "/comer-fora-ou-cozinhar/", "/veiculo-proprio-ou-aplicativo/", "/comparar-hospedagens/", "/veiculo-alugado-ou-aplicativo/", "/custo-da-viagem/"];
await visit("/");
const saved = await evaluate("localStorage.getItem('coyler:theme:v1')");
try {
  assert.deepEqual(await evaluate("[...document.querySelectorAll('a.tool-card')].map(e=>e.getAttribute('href')).sort()"),[...expected].sort());
  assert.equal(await evaluate("document.querySelectorAll('.tool-card a,.tool-card button,.tool-card input').length"),0);
  for (const mode of ["light","dark"]) {
    await theme(mode);
    for (const width of [320,390,1440]) {
      await call("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false});
      assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
      await evaluate("document.querySelector('.tool-card').scrollIntoView({block:'center',behavior:'instant'})");
      await call("Input.dispatchMouseEvent",{type:"mouseMoved",x:0,y:0}); await pause();
      const normal=await evaluate("getComputedStyle(document.querySelector('.tool-card')).backgroundColor");
      const r=await evaluate("(()=>{const r=document.querySelector('.tool-card').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
      await call("Input.dispatchMouseEvent",{type:"mouseMoved",...r}); await pause();
      assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.tool-card')).backgroundColor"),normal);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.tool-card')).cursor"),"pointer");
      await call("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
      await call("Input.dispatchKeyEvent",{type:"keyUp",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
      await evaluate("document.querySelector('.tool-card').focus()");
      assert.ok(await evaluate("document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineStyle==='solid' && getComputedStyle(document.activeElement).outlineWidth==='3px'"));
    }
  }
  await call("Emulation.clearDeviceMetricsOverride");
  for (const href of expected) {
    await visit("/");
    await evaluate(`document.querySelector('a.tool-card[href="${href}"]').focus()`);
    await call("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
    await call("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
    await until(`location.pathname===${JSON.stringify(href)}`);
  }
  await visit("/");
  await evaluate("document.querySelector('.tool-card').scrollIntoView({block:'center',behavior:'instant'})");
  const r=await evaluate("(()=>{const r=document.querySelector('.tool-card').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await call("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...r});
  await call("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...r});
  await until("location.pathname==='/calculadora-custo-de-vida/'");
  await visit("/");
  for (const modifier of ["control","meta","middle"]) {
    await evaluate("document.querySelector('.tool-card').scrollIntoView({block:'center',behavior:'instant'})");
    const r=await evaluate("(()=>{const r=document.querySelector('.tool-card').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
    const before=(await call("Target.getTargets")).result.targetInfos.map(t=>t.targetId);
    const modifiers=modifier==="control"?2:modifier==="meta"?4:0, button=modifier==="middle"?"middle":"left";
    // Cmd is platform-specific; Windows verifies Ctrl and middle click natively.
    if(modifier==="meta") continue;
    await call("Input.dispatchMouseEvent",{type:"mousePressed",button,modifiers,clickCount:1,...r});
    await call("Input.dispatchMouseEvent",{type:"mouseReleased",button,modifiers,clickCount:1,...r}); await pause(500);
    const added=(await call("Target.getTargets")).result.targetInfos.filter(t=>!before.includes(t.targetId)&&t.type==="page");
    assert.ok(added.some(t=>t.url.includes('/calculadora-custo-de-vida/')));
    for(const t of added) await call("Target.closeTarget",{targetId:t.targetId});
  }
  assert.equal(errors.length,0);
  console.log(JSON.stringify({cards:7,enterNavigation:7,wholeSurfaceClick:true,ctrlClick:true,middleClick:true,themes:["light","dark"],widths:[320,390,1440],focus:true}));
} finally {
  await visit("/");
  await evaluate(saved===null?"localStorage.removeItem('coyler:theme:v1')":`localStorage.setItem('coyler:theme:v1',${JSON.stringify(saved)})`);
  ws.close();
}
