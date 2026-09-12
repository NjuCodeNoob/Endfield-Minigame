const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const levels = require('../dist/repair-levels.js');
const C = require('../dist/repair-core.js');
const root = path.resolve(__dirname, '../dist');

async function page(t, level='wl0011', options={}) {
  if(typeof level==='string')level=levels.findIndex(l=>l.id===level);
  const {Window} = await import('happy-dom');
  const w = new Window({url:'http://localhost:5173',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true,disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  t.after(()=>w.happyDOM.close());
  w.document.body.innerHTML=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
  for(const name of ['style.css','repair.css','custom.css','salvage.css']) {
    const style=w.document.createElement('style');style.textContent=fs.readFileSync(path.join(root,name),'utf8');w.document.head.append(style);
  }
  w.played=[];
  if(options.records)w.localStorage.setItem('endfield.repair.records.v1',JSON.stringify(options.records));
  if(options.custom)w.localStorage.setItem('endfield.repair.custom.v1',JSON.stringify(options.custom));
  if(options.musicTrack)w.localStorage.setItem('endfield.music.track.v1',options.musicTrack);
  w.musicPlayed=[];
  w.musicAttempts=0;
  w.Audio=class {constructor(src){this.src=src;this.paused=true;this.currentTime=0;}play(){if(this.src.endsWith('.mp3')){w.musicAttempts++;if(options.rejectFirstMusic&&w.musicAttempts===1)return Promise.reject(new Error('Autoplay denied'));}this.paused=false;(this.src.endsWith('.mp3')?w.musicPlayed:w.played).push(this);return Promise.resolve();}pause(){this.paused=true;}};
  w.requestAnimationFrame=()=>0;
  w.Element.prototype.animate=()=>({cancel(){}});
  w.DOMPoint=class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};
  for(const name of ['audio.js','repair-core.js','repair-levels.js','custom-core.js','custom-ui.js','repair.js','salvage-core.js','salvage-levels.js','salvage-3d.js','salvage-custom-core.js','salvage-custom-ui.js','salvage.js','app.js']) w.eval(fs.readFileSync(path.join(root,name),'utf8'));
  if(options.enter===false)return w;
  w.document.querySelector('[data-module="repair"]').click();
  w.document.querySelector(`[data-level="${level}"]`).click();
  const board=w.document.querySelector('.repair-board');
  board.getBoundingClientRect=()=>({left:200,top:200,right:600,bottom:600,width:400,height:400});
  return w;
}
function pointer(w,target,type,options={}) {
  target.dispatchEvent(new w.PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,button:0,buttons:1,clientX:250,clientY:250,...options}));
}
function pickup(w,id=1) {
  const slot=w.document.querySelector(`.part-slot[data-piece="${id}"]`);
  slot.querySelector('svg').getScreenCTM=()=>({inverse:()=>({})});
  pointer(w,slot,'pointerdown',{clientX:10,clientY:10});
  pointer(w,w,'pointermove');
}
function ghostShape(w) {return w.document.querySelector('.drag-piece .piece-surface')?.getAttribute('d');}
function trayShape(w,id=1) {return w.document.querySelector(`.part-slot[data-piece="${id}"] .piece-surface`)?.getAttribute('d');}

test('home opens salvage directly and preserves the global BGM across replay and exit',async t=>{
  const w=await page(t,0,{enter:false});const music=w.musicPlayed[0];
  w.document.querySelector('[data-module="salvage"]').click();
  assert.equal(w.document.querySelector('#salvage-app').hidden,false);
  assert.equal(w.document.querySelector('dialog').open,false);
  assert.equal(w.document.querySelectorAll('[data-salvage-level]').length,33);
  w.document.querySelector('[data-salvage-level="0"]').click();
  assert.equal(w.document.querySelectorAll('.salvage-cell').length,25);
  assert.equal(w.document.querySelector('.terminal').inert,true);
  w.document.querySelector('.salvage-close').click();
  w.document.querySelector('#salvage-app [data-home]').click();
  assert.equal(w.document.querySelector('.terminal').inert,false);
  assert.equal(music.paused,false);
  assert.equal(new Set(w.musicPlayed).size,1);
});

test('all levels keep every target bar in normal flex layout with both stylesheets loaded',async t=>{
  for(let index=0;index<levels.length;index++){
    const w=await page(t,index),level=levels[index];
    for(const [axis,selector] of [['rows','.row-counts'],['cols','.column-counts']]){
      const groups=[...w.document.querySelector(selector).children];
      assert.equal(groups.length,level.size);
      groups.forEach((group,i)=>{
        for(const color of Object.keys(level[axis])){
          const bars=group.querySelectorAll(`.count-color.${color} .count-unit`);
          assert.equal(bars.length,level[axis][color][i],`${level.id} ${axis} ${i} ${color}`);
          bars.forEach(bar=>{
            assert.equal(w.getComputedStyle(bar).position,'static');
            assert.equal(w.getComputedStyle(bar).flexShrink,'0');
            assert.equal(bar.classList.contains('empty'),false);
          });
        }
      });
    }
    await w.happyDOM.close();
  }
});
test('physical R works during pointer drag with IME Process key and ignores key repeat',async t=>{
  const w=await page(t);pickup(w);
  assert.equal(w.document.activeElement.className,'repair-board');
  const before=ghostShape(w);assert.ok(before);const visual=w.document.querySelector('.drag-rotation');
  const press=repeat=>w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Process',code:'KeyR',repeat}));
  press(false);const after=visual.style.transform;assert.equal(after,'rotate(90deg)');
  press(true);assert.equal(visual.style.transform,after);
  press(false);press(false);press(false);assert.equal(visual.style.transform,'rotate(360deg)');assert.equal(ghostShape(w),before);
});
test('right-click rotates during drag; secondary release leaves it held; primary release commits',async t=>{
  const w=await page(t);pickup(w);const before=ghostShape(w);
  const host=w.document.querySelector('#repair-app');
  const event=new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2});
  host.dispatchEvent(event);assert.ok(event.defaultPrevented);assert.equal(w.document.querySelector('.drag-rotation').style.transform,'rotate(90deg)');
  pointer(w,w,'pointerup',{button:2,buttons:1});assert.ok(ghostShape(w));
  pointer(w,w,'pointermove',{clientX:550,clientY:350});assert.ok(ghostShape(w));
  pointer(w,w,'pointerup',{button:0,buttons:0,clientX:550,clientY:350});assert.equal(ghostShape(w),undefined);
  assert.ok(w.document.querySelector('.placed-piece[data-piece="1"]'));
  assert.equal(w.document.querySelectorAll('.row-counts .count-filled,.row-counts .count-excess').length,9);
});
test('tray right-click rotates its target and R rotates the focused component without dragging',async t=>{
  const w=await page(t),slot=w.document.querySelector('.part-slot[data-piece="1"]'),before=trayShape(w);
  slot.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}));
  const after=trayShape(w);assert.notEqual(after,before);assert.equal(ghostShape(w),undefined);
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'r',code:'KeyR'}));
  assert.notEqual(trayShape(w),after);assert.equal(ghostShape(w),undefined);
});
test('over-target cells render separate striped bars, including a zero-target color',async t=>{
  const w=await page(t,'wl0016-a');pickup(w,0);
  pointer(w,w,'pointermove',{clientX:250,clientY:450});
  pointer(w,w,'pointerup',{button:0,buttons:0,clientX:250,clientY:450});
  const rows=w.document.querySelector('.row-counts').children;
  assert.equal(rows[2].querySelectorAll('.cyan .count-excess').length,2);
  assert.equal(rows[3].querySelectorAll('.cyan .count-excess').length,1);
  for(const bar of w.document.querySelectorAll('.count-excess')){
    assert.equal(w.getComputedStyle(bar).position,'static');
    assert.match(w.getComputedStyle(bar).backgroundImage,/repeating-linear-gradient/);
  }
});
test('module and level selection use different sounds that survive the screen transition',async t=>{
  const w=await page(t);
  assert.equal(w.played.length,2);
  assert.match(w.played[0].src,/\/module\.wav/);
  assert.match(w.played[1].src,/\/level\.wav/);
  assert.ok(w.played.every(a=>!a.paused));
});
test('Tab and mode buttons share the dedicated switch sound, with no repeat or unchanged-mode retrigger',async t=>{
  const w=await page(t),before=w.played.length;
  const tab=repeat=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Tab',repeat}));
  tab(false);assert.match(w.played.at(-1).src,/\/mode\.wav/);assert.equal(w.played.length,before+1);
  tab(true);assert.equal(w.played.length,before+1);
  w.document.querySelector('[data-mode="numeric"]').click();assert.equal(w.played.length,before+1);
  w.document.querySelector('[data-mode="graphic"]').click();assert.equal(w.played.length,before+2);assert.match(w.played.at(-1).src,/\/mode\.wav/);
});
test('mute stops all voices and remains effective for game and selection sounds across screens',async t=>{
  const w=await page(t);
  w.document.querySelector('.sound-button').click();assert.ok(w.TerminalAudio.muted);assert.ok(w.played.every(a=>a.paused));
  const before=w.played.length;
  w.document.querySelector('[data-mode="numeric"]').click();pickup(w);assert.equal(w.played.length,before);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));
  w.document.querySelector('.game-back').click();w.document.querySelector('[data-level="1"]').click();
  assert.equal(w.played.length,before);assert.equal(w.document.querySelector('.sound-button').textContent,'音效 关');
  w.document.querySelector('.sound-button').click();assert.equal(w.TerminalAudio.muted,false);assert.equal(w.played.length,before+1);
});
test('global music loops on one player and retains its playback position across screens',async t=>{
  const w=await page(t),music=w.musicPlayed[0];
  assert.equal(w.musicPlayed.length,1);assert.equal(music.loop,true);assert.equal(music.volume,.25);
  music.currentTime=37;
  w.document.querySelector('.game-back').click();w.document.querySelector('[data-level="1"]').click();
  assert.equal(w.musicPlayed.length,1);assert.equal(music.currentTime,37);assert.equal(music.paused,false);
  w.document.querySelector('.sound-button').click();assert.equal(music.paused,false);
  w.document.querySelector('.global-music-toggle').click();assert.equal(music.paused,true);
  w.document.querySelector('[data-mode="numeric"]').click();assert.equal(music.paused,true);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  w.document.querySelector('.global-music-toggle').click();assert.equal(music.paused,false);assert.equal(music.currentTime,37);
});
test('music attempts playback at initial page load before any interaction',async t=>{
  const w=await page(t,0,{enter:false});
  assert.equal(w.musicAttempts,1);assert.equal(w.musicPlayed.length,1);
  assert.equal(w.musicPlayed[0].autoplay,true);assert.equal(w.musicPlayed[0].loop,true);
});

test('BGM selection switches a single player, remembers the track and respects music off',async t=>{
  const w=await page(t),d=w.document,select=d.querySelector('.global-music-select'),player=w.musicPlayed[0];
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  player.currentTime=20;select.value='sequence-02-1';select.dispatchEvent(new w.Event('change'));
  assert.equal(player.src,'assets/audio/bgm-02-1.mp3');assert.equal(player.currentTime,0);assert.equal(player.loop,true);assert.equal(player.paused,false);
  assert.ok(w.musicPlayed.every(p=>p===player));assert.equal(w.localStorage.getItem('endfield.music.track.v1'),'sequence-02-1');
  d.querySelector('.global-music-toggle').click();const attempts=w.musicAttempts;
  select.value='sequence-02';select.dispatchEvent(new w.Event('change'));
  assert.equal(player.src,'assets/audio/bgm.mp3');assert.equal(player.paused,true);assert.equal(player.autoplay,false);assert.equal(w.musicAttempts,attempts);
  const reopened=await page(t,0,{enter:false,musicTrack:'sequence-02-1'});assert.equal(reopened.musicPlayed[0].src,'assets/audio/bgm-02-1.mp3');
});
test('blocked autoplay retries on the next interaction without an unhandled rejection',async t=>{
  const w=await page(t,0,{enter:false,rejectFirstMusic:true});
  assert.equal(w.musicAttempts,1);assert.equal(w.musicPlayed.length,0);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  w.document.querySelector('[data-module="repair"]').click();
  assert.equal(w.musicAttempts,2);assert.equal(w.musicPlayed.length,1);
});
test('dragging uses the center cell regardless of where the tray component was pressed',async t=>{
  const w=await page(t);
  pickup(w,0); // Cross shape has an actual occupied center square at [1,1].
  const ghost=w.document.querySelector('.drag-piece');
  assert.equal(ghost.style.left,'100px');assert.equal(ghost.style.top,'100px');
  pointer(w,w,'pointermove',{clientX:450,clientY:450});
  assert.equal(ghost.style.left,'300px');assert.equal(ghost.style.top,'300px');
  pointer(w,w,'pointerup',{button:0,buttons:0,clientX:450,clientY:450});
  assert.ok(w.document.querySelector('.placed-piece[data-piece="0"]'));
  // Pick its outermost occupied square from the board: pointer still grips the center.
  pointer(w,w.document.querySelector('.repair-board'),'pointerdown',{clientX:450,clientY:350});
  assert.equal(w.document.querySelector('.drag-piece').style.left,'300px');
  assert.equal(w.document.querySelector('.drag-piece').style.top,'200px');
});
test('IME Process events support Tab, arrows and Enter by physical code; keyup does not repeat actions',async t=>{
  const w=await page(t);
  const key=(type,code,extra={})=>w.document.dispatchEvent(new w.KeyboardEvent(type,{bubbles:true,cancelable:true,key:'Process',code,isComposing:true,...extra}));
  key('keydown','Tab');assert.ok(w.document.querySelector('#repair-app').classList.contains('numeric-mode'));
  key('keyup','Tab');assert.ok(w.document.querySelector('#repair-app').classList.contains('numeric-mode'));
  // An IME may mask the keydown entirely, but restore the physical key on release.
  key('keydown','',{keyCode:229});key('keyup','Tab');
  assert.equal(w.document.querySelector('#repair-app').classList.contains('numeric-mode'),false);
  const slot=w.document.querySelector('.part-slot[data-piece="0"]');slot.focus();
  slot.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Process',code:'Enter',isComposing:true}));
  assert.ok(ghostShape(w));key('keydown','ArrowRight');key('keydown','ArrowDown');key('keydown','Enter');
  assert.ok(w.document.querySelector('.placed-piece[data-piece="0"]'));
  key('keydown','',{keyCode:9});assert.ok(w.document.querySelector('#repair-app').classList.contains('numeric-mode'));
});

test('pointer and keyboard rotations retain one visual and one world-space pivot through rapid turns',async t=>{
  for(const keyboard of [false,true]){
    const w=await page(t),slot=w.document.querySelector('.part-slot[data-piece="1"]');
    if(keyboard)slot.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code:'Enter'}));else pickup(w);
    const ghost=w.document.querySelector('.drag-piece'),visual=ghost.querySelector('.drag-rotation'),svg=visual.querySelector('svg');
    const pivot=()=>{
      const [x,y]=visual.style.transformOrigin.split(' ').map(parseFloat);
      return [parseFloat(ghost.style.left)+parseFloat(visual.style.left)+x,parseFloat(ghost.style.top)+parseFloat(visual.style.top)+y];
    };
    const fixed=pivot();
    for(let turn=1;turn<=8;turn++){
      w.document.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code:'KeyR'}));
      assert.deepEqual(pivot(),fixed,`${keyboard?'keyboard':'pointer'} turn ${turn}`);
      assert.equal(ghost.querySelector('.drag-rotation'),visual);assert.equal(visual.querySelector('svg'),svg);
      assert.equal(visual.style.transform,`rotate(${turn*90}deg)`);
    }
    assert.match(w.getComputedStyle(visual).transition,/transform/);
  }
});

test('all 21 levels can be completed through drag, rotation and drop with fixed-center anchors',async t=>{
  const key=cells=>cells.map(c=>c.join(',')).sort().join(';');
  for(const level of levels){
    const w=await page(t,level.id),size=400/level.size;
    for(const [id,part] of C.initial(level).entries()){
      pickup(w,id);
      const reference=level.pieces[id].cells,target=C.normalize(reference);
      let cells=part.cells,anchor=C.centerCell(cells),turns=0;
      while(key(cells)!==key(target)&&turns++<4){
        const h=Math.max(...cells.map(c=>c[1]))+1;
        anchor=[h-1-anchor[1],anchor[0]];cells=C.rotate(cells);
        w.document.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code:'KeyR'}));
      }
      assert.ok(turns<4);
      const x=Math.min(...reference.map(c=>c[0])),y=Math.min(...reference.map(c=>c[1]));
      const clientX=200+(x+anchor[0]+.5)*size,clientY=200+(y+anchor[1]+.5)*size;
      pointer(w,w,'pointermove',{clientX,clientY});
      assert.ok(w.document.querySelector('.snap-preview.valid'),`${level.id} piece ${id}`);
      pointer(w,w,'pointerup',{button:0,buttons:0,clientX,clientY});
      assert.ok(w.document.querySelector(`.placed-piece[data-piece="${id}"]`));
    }
    assert.ok(w.document.querySelector('.board-complete'),level.id);
    await w.happyDOM.close();
  }
});

test('hub stages precede the original levels and existing best records still appear',async t=>{
  const w=await page(t,0,{enter:false,records:{wl0011:12500,'hub-v40006-1':9000}});
  w.document.querySelector('[data-module="repair"]').click();
  const cards=[...w.document.querySelectorAll('.level-card[data-level]')];
  assert.equal(cards.length,21);assert.match(cards[0].textContent,/Δ-V40006.*1\/2/);
  assert.match(cards[12].textContent,/Δ-WL0011/);assert.match(cards[12].textContent,/00:12.50/);
  assert.match(w.document.querySelector('.completion-count').textContent,/2.*21/);
  assert.match(cards[9].textContent,/双色/);
  cards[5].click();assert.equal(w.document.querySelectorAll('.column-counts .count-zero').length,1);
});

test('custom editor creates, validates, saves, exports, reimports and deletes a playable level',async t=>{
  const w=await page(t,0,{enter:false}),d=w.document;
  d.querySelector('[data-module="repair"]').click();
  assert.ok(d.querySelector('.level-grid').lastElementChild.matches('[data-custom]'));
  d.querySelector('[data-custom]').click();d.querySelector('[data-create]').click();
  assert.equal(d.querySelectorAll('[data-shape]').length,21);
  d.querySelector('[data-generate]').click();assert.match(d.querySelector('.custom-notice').textContent,/至少/);
  const name=d.querySelector('#custom-name');name.value='用户的关卡';name.dispatchEvent(new w.Event('input'));
  const n=d.querySelector('#custom-size');n.value='3';n.dispatchEvent(new w.Event('change'));
  d.querySelector('[data-cell="0"]').click(); // Vertical domino.
  d.querySelector('[data-enable="blue"]').click();d.querySelector('[data-color="blue"]').click();d.querySelector('[data-cell="1"]').click();
  d.querySelector('[data-enable="amber"]').click();d.querySelector('[data-color="amber"]').click();d.querySelector('[data-cell="2"]').click();
  d.querySelector('[data-tool="block"]').click();d.querySelector('[data-cell="8"]').click();
  d.querySelector('[data-generate]').click();const seed=d.querySelector('#custom-seed-output').value;
  assert.match(seed,/^EFT1\./);assert.equal(w.CustomRepair.decode(seed).pieces.length,3);assert.match(d.querySelector('.custom-notice').textContent,/已保存/);
  d.querySelector('[data-play]').click();assert.ok(d.querySelector('.custom-game'));
  assert.equal(d.querySelectorAll('.board-cell').length,9);assert.equal(d.querySelectorAll('.part-slot').length,3);
  d.querySelector('.game-back').click();assert.equal(d.querySelectorAll('[data-level]').length,22);
  d.querySelector('[data-custom]').click();d.querySelector('[data-import]').click();
  d.querySelector('#custom-seed-input').value=seed;d.querySelector('.custom-import').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  d.querySelector('[data-list]').click();assert.equal(d.querySelectorAll('[data-level]').length,22);
  d.querySelector('[data-delete-custom]').click();assert.equal(d.querySelectorAll('[data-level]').length,21);assert.equal(w.CustomRepair.read(w.localStorage).length,0);
});

test('15x15 custom three-color boards fit common viewport bounds and allocate nonoverlapping count lanes',async t=>{
  const K=require('../dist/custom-core'),draft={name:'Δ-大棋盘',size:15,blocked:[],pieces:[]};
  for(let y=0;y<15;y++)for(let x=0;x<14;x+=2)draft.pieces.push({color:K.COLORS[(x+y)%3],cells:[[x,y],[x+1,y]]});
  const l=K.create(draft),w=await page(t,21,{custom:[l.seed]}),host=w.document.querySelector('.custom-game');
  for(const [width,height] of [[1920,1080],[1366,768],[1024,600],[812,375],[700,800],[375,667],[320,568]]){
    Object.defineProperty(w,'innerWidth',{value:width,configurable:true});Object.defineProperty(w,'innerHeight',{value:height,configurable:true});w.dispatchEvent(new w.Event('resize'));
    const value=k=>parseFloat(host.style.getPropertyValue(k)),cell=value('--custom-cell'),x=value('--custom-board-x'),y=value('--custom-board-y'),lane=value('--counter-lane'),tick=value('--counter-tick');
    assert.ok(x-cell*15/2-(tick*15+14)-6>=0,`${width} left counts`);assert.ok(x+cell*15/2<=width,`${width} right edge`);
    assert.ok(y-cell*15/2-(tick*15+14)-6>=0,`${height} top counts`);assert.ok(y+cell*15/2<=height,`${height} bottom edge`);
    assert.ok(lane*3+4<=cell+0.01,`${width} color lanes`);
    assert.ok(host.classList.contains('three-color'));
    const square=value('--counter-square'),gap=value('--counter-color-gap');
    assert.ok(square*3+gap*2<=cell+0.01,`${width} square color lanes`);
    const bar=w.document.querySelector('.count-unit'),style=w.getComputedStyle(bar);
    assert.equal(style.width,style.height,'three-color counters are squares');
  }
});

test('imported custom level wins, saves best time and preserves it on duplicate import and reload',async t=>{
  const K=require('../dist/custom-core'),level=K.create({name:'Δ-最短回路',size:3,blocked:[],pieces:[{color:'lime',cells:[[0,0],[0,1]]}]}),w=await page(t,21,{custom:[level.seed]});
  pickup(w,0);pointer(w,w,'pointermove',{clientX:200+400/6,clientY:200+400/6});pointer(w,w,'pointerup',{button:0,buttons:0});
  assert.ok(w.document.querySelector('.board-complete'));
  const records=JSON.parse(w.localStorage.getItem('endfield.repair.records.v1'));assert.ok(records[level.id]>0);
  w.CustomRepair.save(w.localStorage,w.CustomRepair.decode(level.seed));assert.equal(JSON.parse(w.localStorage.getItem('endfield.repair.records.v1'))[level.id],records[level.id]);
  const again=await page(t,0,{enter:false,custom:[level.seed],records});again.document.querySelector('[data-module="repair"]').click();
  assert.match(again.document.querySelector('.custom-card-wrap').textContent,/最佳/);
});

test('editor places colored fixed cells, prevents overlaps and disabled colors, then imports them locked',async t=>{
  const w=await page(t,0,{enter:false}),d=w.document;
  d.querySelector('[data-module="repair"]').click();d.querySelector('[data-custom]').click();d.querySelector('[data-create]').click();
  d.querySelector('[data-cell="0"]').click();
  d.querySelector('[data-enable="blue"]').click();d.querySelector('[data-color="blue"]').click();d.querySelector('[data-tool="fixed"]').click();d.querySelector('[data-cell="4"]').click();
  assert.equal(d.querySelectorAll('.editor-pieces .fixed-cell.blue').length,1);
  d.querySelector('[data-enable="blue"]').click();assert.equal(d.querySelector('[data-enable="blue"]').checked,true);
  d.querySelector('[data-tool="block"]').click();d.querySelector('[data-cell="4"]').click();assert.match(d.querySelector('.custom-notice').textContent,/固有块/);
  d.querySelector('[data-enable="amber"]').click();d.querySelector('[data-tool="fixed"]').click();d.querySelector('[data-color="amber"]').click();d.querySelector('[data-cell="4"]').click();
  assert.equal(d.querySelectorAll('.editor-pieces .fixed-cell.amber').length,1);
  d.querySelector('[data-cell="3"]').click();d.querySelector('[data-tool="erase"]').click();d.querySelector('[data-cell="3"]').click();assert.equal(d.querySelectorAll('.editor-pieces .fixed-cell').length,1);
  d.querySelector('[data-generate]').click();const seed=d.querySelector('textarea').value;assert.match(seed,/^EFT2\./);
  d.querySelector('[data-play]').click();assert.equal(d.querySelectorAll('.fixed-layer .fixed-cell.amber').length,1);
  assert.equal(d.querySelectorAll('.row-counts .amber .count-filled').length,1);
  const board=d.querySelector('.repair-board');board.getBoundingClientRect=()=>({left:200,top:200,width:400,height:400,right:600,bottom:600});
  pointer(w,board,'pointerdown',{clientX:560,clientY:240});assert.equal(d.querySelector('.drag-piece'),null);
});
