const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../dist/salvage-core.js'),L=C.level;
test('reference WL-A0007 uses five sockets, one lift-2 and two lift-1 balloons',()=>{
  assert.equal(L.size,5);assert.equal(L.sockets.length,5);assert.deepEqual(L.balloons.map(b=>b.lift),[2,1,1]);
  let a=C.initial();assert.equal(C.evaluate(L,a).ready,false);
  a=C.move(L,a,0,0,2);a=C.move(L,a,1,3,1);a=C.move(L,a,2,3,3);
  assert.deepEqual(C.evaluate(L,a),{lift:4,horizontal:-2,vertical:0,placed:3,all:true,balanced:false,valid:true,ready:false});
  a=C.move(L,a,0,1,2);assert.equal(C.evaluate(L,a).ready,true);
  a=C.remove(a,2);assert.equal(C.evaluate(L,a).ready,false);assert.equal(C.evaluate(L,a).vertical,-1);
});
test('placements reject occupied cells, non-sockets, invalid coordinates and tampered inventory',()=>{
  let a=C.move(L,C.initial(),0,1,2);
  for(const [id,x,y] of [[1,1,2],[1,2,2],[1,-1,2],[1,5,2],[1,1.5,2],[99,3,1]])assert.equal(C.move(L,a,id,x,y),a);
  assert.equal(C.evaluate(L,[{id:0,lift:4,x:2,y:2}]).ready,false);
  assert.equal(C.evaluate(L,[{id:0,lift:2,x:1,y:2},{id:1,lift:1,x:3,y:1},{id:1,lift:1,x:3,y:3}]).valid,false);
});
test('all valid full-board assignments agree with torque equations; reference has one solution up to equal balloon identity',()=>{
  const solutions=new Set();
  for(const a of L.sockets)for(const b of L.sockets)for(const c of L.sockets){
    const items=L.balloons.map((v,i)=>({...v,x:[a,b,c][i][0],y:[a,b,c][i][1]}));
    const s=C.evaluate(L,items);
    if(s.ready)solutions.add(JSON.stringify([a,[b,c].sort()]));
  }
  assert.equal(solutions.size,1);
});
async function page(t,records){
  const {Window}=await import('happy-dom');const w=new Window({url:'http://localhost:5173',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true,disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  t.after(()=>w.happyDOM.close());w.document.body.innerHTML='<div class="terminal"><button data-module="salvage">浮空回收</button></div>';
  w.sounds=[];w.TerminalAudio={play:n=>w.sounds.push(n),stopGameplay:()=>{}};
  if(records)w.localStorage.setItem('endfield.salvage.records.v1',JSON.stringify(records));
  w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
  for(const file of ['style.css','repair.css','salvage.css']){const el=w.document.createElement('style');el.textContent=fs.readFileSync(path.join(__dirname,'../dist',file),'utf8');w.document.head.append(el);}
  for(const file of ['salvage-core.js','salvage-levels.js','salvage-3d.js','salvage-custom-core.js','salvage-custom-ui.js','salvage.js'])w.eval(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'));
  w.SalvageGame.start();return w;
}
function key(w,el,code){el.dispatchEvent(new w.KeyboardEvent('keydown',{code,key:code,bubbles:true,cancelable:true}));}
function place(w,value,x,y){key(w,w.document.querySelector(`.salvage-stock .value-${value}`).closest('button'),'Enter');key(w,w.document.querySelector(`[data-x="${x}"][data-y="${y}"]`),'Enter');}
test('playable UI keeps completion locked until correct balance; reset returns inventory',async t=>{
  const w=await page(t),d=w.document;
  assert.equal(d.querySelectorAll('.salvage-cell').length,25);assert.equal(d.querySelectorAll('.socket').length,5);
  assert.equal(w.getComputedStyle(d.querySelector('.salvage-footer')).pointerEvents,'auto');
  assert.equal(d.querySelector('.salvage-submit').disabled,true);
  place(w,2,0,2);place(w,1,3,1);place(w,1,3,3);
  assert.equal(d.querySelector('.salvage-submit').disabled,true);assert.match(d.querySelector('.salvage-status').textContent,/未达到平衡/);
  key(w,d.querySelector('.salvage-balloon[data-id="0"]'),'Enter');key(w,d.querySelector('[data-x="1"][data-y="2"]'),'Enter');
  assert.equal(d.querySelector('.salvage-submit').disabled,false);assert.ok(w.sounds.includes('salvage-ready'));
  assert.equal(d.querySelectorAll('.salvage-stock:disabled').length,2);
  d.querySelector('.salvage-reset').click();assert.equal(d.querySelectorAll('.salvage-balloon').length,0);assert.equal(d.querySelector('.salvage-lift text').textContent,'0/4');
  w.SalvageGame.close();assert.equal(d.querySelector('.terminal').inert,false);assert.equal(d.querySelector('#salvage-app').hidden,true);
});
test('pointer drag uses transformed SVG coordinates, rolls back invalid drops and can return a balloon to inventory',async t=>{
  const w=await page(t),d=w.document,svg=d.querySelector('.salvage-board');
  svg.getBoundingClientRect=()=>({left:0,top:0,width:600,height:600});
  svg.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}});
  svg.getScreenCTM=()=>({inverse:()=>({})});
  d.querySelector('.salvage-inventory').getBoundingClientRect=()=>({left:700,right:900,top:100,bottom:500});
  function pointer(target,type,x,y){target.dispatchEvent(new w.PointerEvent(type,{pointerId:1,button:0,bubbles:true,cancelable:true,clientX:x,clientY:y}));}
  pointer(d.querySelector('.salvage-stock'),'pointerdown',800,150);pointer(w,'pointermove',220,300);pointer(w,'pointerup',220,300);
  assert.equal(d.querySelectorAll('.salvage-balloon').length,1);assert.equal(d.querySelectorAll('.salvage-drag').length,0);
  pointer(d.querySelector('.salvage-balloon'),'pointerdown',220,300);pointer(w,'pointermove',300,300);pointer(w,'pointerup',300,300);
  assert.match(d.querySelector('.salvage-balloon').getAttribute('aria-label'),/第3行第2列/);
  pointer(d.querySelector('.salvage-balloon'),'pointerdown',220,300);pointer(w,'pointermove',800,200);pointer(w,'pointerup',800,200);
  assert.equal(d.querySelectorAll('.salvage-balloon').length,0);
});
test('completion displays result and can replay; leaving during animation cancels completion',async t=>{
  const w=await page(t),d=w.document,callbacks=new Map();let next=0;
  w.setTimeout=(fn)=>{callbacks.set(++next,fn);return next;};w.clearTimeout=id=>callbacks.delete(id);
  place(w,2,1,2);place(w,1,3,1);place(w,1,3,3);d.querySelector('.salvage-submit').click();
  assert.ok(d.querySelector('#salvage-app').classList.contains('is-recovering'));assert.equal(d.querySelector('.salvage-submit').disabled,true);
  [...callbacks.values()][0]();assert.equal(d.querySelector('.salvage-result').hidden,false);assert.ok(w.sounds.includes('salvage-success'));
  d.querySelector('[data-result="again"]').click();assert.equal(d.querySelector('.salvage-result').hidden,true);assert.equal(d.querySelector('.salvage-lift text').textContent,'0/4');
  place(w,2,1,2);place(w,1,3,1);place(w,1,3,3);d.querySelector('.salvage-submit').click();w.SalvageGame.close();assert.equal(callbacks.size,0);
});
test('five new reference audio cues exist, are distinct stereo samples and have bounded peaks',()=>{
  const dir=path.join(__dirname,'../dist/assets/audio'),meta=JSON.parse(fs.readFileSync(path.join(dir,'salvage-sources.json'))),hashes=new Set();
  assert.equal(Object.keys(meta.sounds).length,5);
  for(const [name,info] of Object.entries(meta.sounds)){
    const wav=fs.readFileSync(path.join(dir,name+'.wav')),hash=require('node:crypto').createHash('sha256').update(wav).digest('hex');
    assert.equal(hash,info.sha256);assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),48000);assert.ok(info.peak_dbfs<=-9.99);hashes.add(hash);
  }
  assert.equal(hashes.size,5);
});

test('all 32 video stages retain their order, inventory and a legal solvable board',()=>{
  const levels=require('../dist/salvage-levels.js'),solve=require('./salvage-solver.cjs');
  assert.equal(levels.length,33);assert.equal(new Set(levels.map(l=>l.id)).size,33);
  assert.deepEqual(levels.slice(1).map(l=>l.lift),[9,12,6,7,16,6,9,18,22,10,3,8,15,6,28,36,16,12,27,39,6,21,27,10,15,13,15,23,8,6,14,14]);
  for(const level of levels){const solution=solve(level);assert.ok(solution,level.code);assert.equal(C.evaluate(level,solution).ready,true,level.code);assert.equal(new Set(level.sockets.map(p=>p.join(','))).size,level.sockets.length);}
  for(let group=1;group<=20;group++){const stages=levels.filter(l=>l.group===group);assert.equal(stages.length,stages[0].total);assert.deepEqual(stages.map(l=>l.stage),Array.from({length:stages.length},(_,i)=>i+1));}
});

test('perspective camera and inverse ray-plane picking agree through all extreme tilts',()=>{
  const D=require('../dist/salvage-3d.js');
  for(const pitch of [-.49,-.2,0,.2,.49])for(const yaw of [-.62,-.3,0,.3,.62])for(let y=0;y<5;y++)for(let x=0;x<5;x++){
    const projected=D.project([x*80-160,y*80-160,0],pitch,yaw),local=D.unproject(projected.x,projected.y,pitch,yaw);
    assert.ok(Math.abs(local.x-(140+x*80))<1e-8);assert.ok(Math.abs(local.y-(140+y*80))<1e-8);
  }
  const goal=D.target(-4,0,2),near=D.project([-200,0,0],goal.pitch,goal.yaw),far=D.project([200,0,0],goal.pitch,goal.yaw);assert.ok(near.scale>far.scale,'greater left lift raises the left edge toward the camera');
  assert.equal(D.mesh(0,0,.2,.3).faces.length,12);
});

test('spring maintains velocity across interrupted targets and settles without drift',()=>{
  const D=require('../dist/salvage-3d.js'),state={pitch:0,yaw:0,vp:0,vy:0};
  for(let i=0;i<12;i++)D.step(state,D.target(6,4,8),1/60);
  const before=state.yaw,velocity=state.vy;assert.notEqual(velocity,0);
  D.step(state,D.target(-6,-4,8),1/60);assert.ok(Math.abs(state.yaw-before)<.06,'retargeting does not teleport the board');
  for(let i=0;i<600;i++)D.step(state,{pitch:0,yaw:0},1/60);
  assert.ok(Math.abs(state.pitch)+Math.abs(state.yaw)+Math.abs(state.vp)+Math.abs(state.vy)<1e-8);
});

test('every video level is playable through the UI and uses grade four for lift six',async t=>{
  const w=await page(t),levels=require('../dist/salvage-levels.js'),solve=require('./salvage-solver.cjs'),d=w.document;
  for(let index=0;index<levels.length;index++){
    const level=levels[index];w.SalvageGame.start(index);
    assert.equal(d.querySelector('.salvage-lift text').textContent,`0/${level.lift}`);
    for(const balloon of solve(level))place(w,balloon.lift,balloon.x,balloon.y);
    assert.equal(d.querySelector('.salvage-submit').disabled,false,level.code);
    if(level.balloons.some(b=>b.lift===6))assert.match(d.querySelector('.salvage-tray').textContent,/4级回收气球/);
  }
});

test('best records survive slower clears and reload, improve on faster clears, and appear in selector',async t=>{
  const w=await page(t,{'wl-a0007':5000}),d=w.document;let now=10000;Object.defineProperty(w.performance,'now',{value:()=>now,configurable:true});
  for(const elapsed of [8000,3000]){
    w.SalvageGame.start(0);place(w,2,1,2);place(w,1,3,1);place(w,1,3,3);now+=elapsed;d.querySelector('.salvage-submit').click();
    assert.equal(JSON.parse(w.localStorage.getItem('endfield.salvage.records.v1'))['wl-a0007'],Math.min(5000,elapsed));
  }
  w.SalvageGame.open();assert.match(d.querySelector('[data-salvage-level="0"] .card-record').textContent,/00:03.00/);assert.equal(d.querySelectorAll('.level-card.cleared').length,1);
  const w2=await page(t,JSON.parse(w.localStorage.getItem('endfield.salvage.records.v1')));w2.SalvageGame.open();assert.match(w2.document.querySelector('[data-salvage-level="0"] .card-record').textContent,/00:03.00/);
});

test('next module starts the next recorded stage with fresh inventory and clock',async t=>{
  const w=await page(t),d=w.document;let callback;
  w.setTimeout=fn=>{callback=fn;return 1;};w.clearTimeout=()=>{};
  place(w,2,1,2);place(w,1,3,1);place(w,1,3,3);d.querySelector('.salvage-submit').click();callback();d.querySelector('[data-result="next"]').click();
  assert.match(d.querySelector('.salvage-instructions h2').textContent,/WL-A1002/);assert.equal(d.querySelector('.salvage-lift text').textContent,'0/9');assert.equal(d.querySelectorAll('.salvage-balloon').length,0);
});

test('drop swaps occupied sockets and replaces from inventory without losing balloons',()=>{
  let a=C.initial();a=C.drop(L,a,0,1,2);a=C.drop(L,a,1,3,1);a=C.drop(L,a,0,3,1);
  assert.deepEqual(a.map(b=>[b.x,b.y]),[[3,1],[1,2],[null,null]]);
  a=C.drop(L,a,2,3,1);assert.deepEqual(a.map(b=>[b.x,b.y]),[[null,null],[1,2],[3,1]]);
  assert.equal(C.evaluate(L,a).valid,true);assert.equal(a.length,3);
  assert.equal(C.drop(L,a,2,2,2),a);
});

test('axis labels show exact magnitude, direction and zero; controls use centered SVG icons',async t=>{
  const w=await page(t),d=w.document;place(w,2,0,2);
  assert.match(d.querySelector('.salvage-axes').textContent,/4 ◀/);assert.match(d.querySelector('.salvage-axes').textContent,/0/);
  assert.equal(d.querySelector('.salvage-close svg').getAttribute('viewBox'),'0 0 32 32');
  assert.equal(w.getComputedStyle(d.querySelector('.salvage-close')).placeItems,'center');
  assert.ok(d.querySelector('.salvage-reset svg path').getAttribute('d').includes('a10 10'));
});

test('custom seeds are canonical, portable, validated and deduplicate safely',()=>{
  const K=require('../dist/salvage-custom-core.js'),draft={name:'Δ-浮空测试',sockets:[[1,2],[3,2],[2,2]],answer:[{x:1,y:2,lift:2},{x:3,y:2,lift:2}]};
  const l=K.create(draft),same=K.create({...draft,sockets:[...draft.sockets].reverse(),answer:[...draft.answer].reverse()});
  assert.equal(l.seed,same.seed);assert.deepEqual(K.decode(l.seed),l);
  assert.throws(()=>K.create({...draft,answer:[{x:1,y:2,lift:2}]}),/平衡/);
  assert.throws(()=>K.decode(l.seed.slice(0,-1)+(l.seed.endsWith('0')?'1':'0')),/校验/);
  assert.throws(()=>K.create({...draft,name:'Δ-<script>'}));
  const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};
  K.save(storage,l);K.save(storage,same);assert.equal(K.read(storage).length,1);K.remove(storage,l.id);assert.equal(K.read(storage).length,0);
});

test('custom editor creates, exports, imports, plays and deletes a level with its record',async t=>{
  const w=await page(t),d=w.document;w.SalvageGame.open();d.querySelector('[data-salvage-custom]').click();d.querySelector('[data-create]').click();
  const cell=i=>d.querySelector(`[data-cell="${i}"]`);
  cell(11).click();cell(13).click();d.querySelector('[data-tool="2"]').click();cell(11).click();cell(13).click();d.querySelector('[data-save]').click();
  assert.match(d.querySelector('.custom-header h2').textContent,/已保存/);const seed=d.querySelector('textarea').value;
  d.querySelector('[data-play]').click();place(w,2,1,2);place(w,2,3,2);d.querySelector('.salvage-submit').click();
  w.SalvageGame.open();assert.equal(d.querySelectorAll('[data-salvage-level]').length,34);assert.ok(d.querySelector('[data-salvage-level="33"]').classList.contains('cleared'));
  d.querySelector('[data-salvage-custom]').click();d.querySelector('[data-import]').click();d.querySelector('textarea').value=seed;d.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));d.querySelector('[data-back]').click();
  assert.equal(d.querySelectorAll('[data-salvage-level]').length,34);
  d.querySelector('[data-salvage-delete]').click();assert.equal(d.querySelectorAll('[data-salvage-level]').length,33);assert.deepEqual(JSON.parse(w.localStorage.getItem('endfield.salvage.records.v1')),{});
  d.querySelector('[data-salvage-custom]').click();key(w,d,'Escape');assert.equal(d.querySelector('#salvage-app').hidden,false);assert.ok(d.querySelector('[data-salvage-custom]'));
});

test('pointer drops swap board balloons and send displaced balloons back to inventory',async t=>{
  const w=await page(t),d=w.document,svg=d.querySelector('.salvage-board');
  svg.getBoundingClientRect=()=>({left:0,top:0,width:600,height:600});svg.getScreenCTM=()=>({inverse:()=>({})});svg.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}});
  d.querySelector('.salvage-inventory').getBoundingClientRect=()=>({left:700,right:900,top:100,bottom:500});
  function drop(id,x,y){const source=d.querySelector(`.salvage-balloon[data-id="${id}"]`)||d.querySelector(`.salvage-stock[data-id="${id}"]`);for(const [target,type,px,py] of [[source,'pointerdown',800,200],[w,'pointermove',140+x*80,140+y*80],[w,'pointerup',140+x*80,140+y*80]])target.dispatchEvent(new w.PointerEvent(type,{pointerId:1,button:0,bubbles:true,cancelable:true,clientX:px,clientY:py}));}
  drop(0,1,2);drop(1,3,1);drop(0,3,1);
  assert.match(d.querySelector('.salvage-balloon[data-id="1"]').getAttribute('aria-label'),/第3行第2列/);
  drop(2,3,1);assert.equal(d.querySelector('.salvage-balloon[data-id="0"]'),null);assert.equal(d.querySelector('.salvage-stock[data-id="0"]').disabled,false);assert.equal(d.querySelectorAll('.salvage-balloon').length,2);
});
