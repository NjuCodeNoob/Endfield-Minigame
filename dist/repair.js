(() => {
  const C=RepairCore,K=CustomRepair,audio=window.TerminalAudio;
  const customStorage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
  const levels=[...RepairLevels,...K.read(customStorage)];
  const escape=CustomRepairUI.escape;
  const host=document.createElement('section');host.id='repair-app';host.hidden=true;document.body.append(host);
  let screen='home',current=0,pieces=[],drag=null,selected=null,startTime=0,finished=false,numeric=false,raf=0,completionTimer=0,records={},shapeId=0;
  const STORAGE='endfield.repair.records.v1';
  try {const saved=JSON.parse(localStorage.getItem(STORAGE)||'{}');if(saved&&typeof saved==='object')records=saved;}catch{}
  const formatTime=ms=>{const c=Math.floor(ms/10);return `${String(Math.floor(c/6000)).padStart(2,'0')}:${String(Math.floor(c/100)%60).padStart(2,'0')}.${String(c%100).padStart(2,'0')}`;};
  const validRecord=id=>Number.isFinite(records[id])&&records[id]>0?records[id]:null;
  const iconClose='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="m7 7 7 7m4 4 7 7M25 7l-7 7m-4 4-7 7"/></svg>';
  const sound=type=>audio.play(type);
  const colorName=color=>({cyan:'青绿',amber:'琥珀',lime:'黄绿',blue:'蓝色'}[color]||color);
  const moduleCode=level=>escape(level.code+(level.stage?' / '+level.stage:level.id.endsWith('-b')?' / II':''));
  function shapeSVG(cells,color,extra='') {
    const w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1,d=C.outline(cells),id=`shape-${++shapeId}`;
    return `<svg class="circuit-piece ${color} ${extra}" viewBox="-5 -5 ${w*100+10} ${h*100+10}" aria-hidden="true" style="--pw:${w};--ph:${h};--snap-fill:url(#${id}-stripe)"><defs><clipPath id="${id}"><path d="${d}"/></clipPath><pattern id="${id}-stripe" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="12" fill="#fff" opacity=".3"/></pattern></defs><path class="piece-surface" d="${d}"/><g clip-path="url(#${id})">${cells.map(([x,y],i)=>`<rect x="${x*100}" y="${y*100}" width="100" height="100" fill="${i%2?'#ffffff':'#000000'}" opacity=".045"/>`).join('')}<path class="piece-inner-edge" d="${d}"/></g><path class="piece-outline" d="${d}"/></svg>`;
  }
  function clean(){cancelAnimationFrame(raf);clearTimeout(completionTimer);cancelDrag();audio.stopGameplay();}
  function home(){clean();screen='home';host.hidden=true;host.innerHTML='';document.querySelector('.terminal').inert=false;document.querySelector('[data-module="repair"]').focus();}
  function miniBoard(level){
    return `<span class="level-mini" style="--n:${level.size}" aria-hidden="true">${Array.from({length:level.size**2},(_,i)=>{const x=i%level.size,y=Math.floor(i/level.size),f=(level.fixed||[]).find(c=>c[0]===x&&c[1]===y),b=(level.blocked||[]).some(c=>c[0]===x&&c[1]===y);return `<i class="${b?'blocked':f?f[2]:'vacant'}">${f?'⌑':''}</i>`;}).join('')}</span>`;
  }
  function openCustom(level){
    clean();screen='custom';host.hidden=true;
    const options={shapeSVG,onClose(id,play){
      levels.splice(RepairLevels.length,levels.length-RepairLevels.length,...K.read(customStorage));
      const index=levels.findIndex(l=>l.id===id);if(index>=0)current=index;
      if(play&&index>=0)startLevel(index);else showLevels();
    }};
    sound('module');if(level)CustomRepairUI.showSeed(options,level);else CustomRepairUI.open(options);
  }
  function deleteCustom(index){
    const level=levels[index];if(!level?.custom)return;
    try{K.remove(customStorage,level.id);}catch(error){host.querySelector('.selector-notice').textContent=error.message;return;}
    delete records[level.id];try{localStorage.setItem(STORAGE,JSON.stringify(records));}catch{}
    showLevels();host.querySelector('.selector-notice').textContent=`已删除 ${level.code}`;
  }
  function layoutCustomGame(){
    if(screen!=='game'||!levels[current]?.custom)return;
    const n=levels[current].size,k=Object.keys(levels[current].rows).length,w=window.innerWidth,h=window.innerHeight,small=w<=700;
    const left=small?14:Math.min(190,w*.22),right=small?14:205,top=small?115:100,bottom=small?205:105;
    // Each color owns its own lane. The count rail holds up to n bars, including excess.
    host.classList.toggle('three-color',k===3);
    const rail=Math.max(48,k===3?n*3+6:n*8+9),gap=8,availableW=w-left-right,availableH=Math.max(50,h-top-bottom);
    const s=Math.max(1,Math.min(58,(availableW-rail-gap)/n,(availableH-rail-gap)/n));
    const board=n*s,x=left+(availableW-board-rail-gap)/2+rail+gap+board/2,y=top+(availableH-board-rail-gap)/2+rail+gap+board/2;
    host.style.setProperty('--custom-cell',`${s}px`);host.style.setProperty('--custom-board-x',`${x}px`);host.style.setProperty('--custom-board-y',`${y}px`);
    const colorGap=Math.min(3,s/8),square=Math.max(.25,Math.min(6,(s-colorGap*2)/3,(rail-(n-1)*2)/n));
    host.style.setProperty('--counter-color-gap',`${colorGap}px`);
    host.style.setProperty('--counter-square',`${square}px`);
    host.style.setProperty('--counter-font',`${Math.min(8,s/2)}px`);
    const barLength=Math.min(25,Math.max(12,w*.014)),barScale=Math.min(1,Math.max(.05,(s-(k-1)*4)/(k*barLength)));
    host.style.setProperty('--counter-bar-length',`${barLength*barScale}px`);
    host.style.setProperty('--counter-bar-width',`${5*barScale}px`);
    host.style.setProperty('--counter-bar-gap',`${3*barScale}px`);
    host.style.setProperty('--counter-lane',`${Math.max(1,(s-(k-1)*2)/k)}px`);host.style.setProperty('--counter-tick',`${Math.max(1,(rail-(n-1))/n)}px`);
  }
  function showLevels(){
    clean();levels.splice(RepairLevels.length,levels.length-RepairLevels.length,...K.read(customStorage));current=Math.min(current,levels.length-1);screen='levels';host.hidden=false;host.className='repair-selector';document.querySelector('.terminal').inert=true;
    host.innerHTML=`<div class="selector-noise"></div><header class="selector-header"><button class="selector-back" data-home>‹</button><span>终末地模拟终端 <b>›</b> 修复机器人</span><button class="repair-close" data-home aria-label="返回首页">${iconClose}</button></header><div class="selector-content"><div class="selector-title"><div><p>REPAIR TERMINAL / MODULE DIRECTORY</p><h2>选择修复模块<span>设备修复</span></h2></div><span class="completion-count">${levels.filter(l=>validRecord(l.id)).length}<small> / ${String(levels.length).padStart(2,'0')} 已修复</small></span></div><div class="level-grid">${levels.map((level,i)=>`${level.custom?'<div class="custom-card-wrap">':''}<button class="level-card ${validRecord(level.id)?'cleared':''}" data-level="${i}"><span class="card-number">${String(i+1).padStart(2,'0')}</span><span class="card-code">${moduleCode(level)}</span>${miniBoard(level)}<span class="card-title">${escape(level.name)}</span><span class="card-meta">${level.size} × ${level.size}<b>·</b>${level.pieces.length} 元件<b>·</b>${['单色','双色','三色'][Object.keys(level.rows).length-1]}</span><span class="card-record">${validRecord(level.id)?`<i>✓ 已修复</i><span>最佳 ${formatTime(validRecord(level.id))}</span>`:'<i>待修复</i><span>进入模块 ↗</span>'}</span></button>${level.custom?`<div class="custom-card-actions"><button data-seed-custom="${i}">种子</button><button data-delete-custom="${i}" aria-label="删除 ${escape(level.code)}">删除</button></div></div>`:''}`).join('')}<button class="level-card custom-entry" data-custom><span class="card-number">＋</span><span class="card-code">CUSTOM MODULE</span><span class="card-title">自定义</span><span class="card-meta">创建关卡 · 导入关卡</span></button></div><p class="selector-notice" role="status"></p><div class="selector-bottom"><span>拖放元件 · 校准行列 · 接通回路</span><span>ENDFIELD / REPAIR SYSTEM</span></div></div>`;
    host.querySelectorAll('[data-home]').forEach(b=>b.onclick=home);
    host.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{sound('level');startLevel(Number(b.dataset.level));});
    host.querySelector('[data-custom]').onclick=()=>openCustom();
    host.querySelectorAll('[data-seed-custom]').forEach(b=>b.onclick=()=>openCustom(levels[Number(b.dataset.seedCustom)]));
    host.querySelectorAll('[data-delete-custom]').forEach(b=>b.onclick=()=>deleteCustom(Number(b.dataset.deleteCustom)));
    host.querySelector(`[data-level="${current}"]`)?.focus({preventScroll:true});
  }
  function startLevel(index){
    clean();current=index;screen='game';finished=false;selected=null;pieces=C.initial(levels[current]);host.className='repair-game'+(levels[current].custom?' custom-game':'');host.hidden=false;
    const level=levels[current];
    host.innerHTML=`<div class="game-atmosphere" aria-hidden="true"></div><header class="game-header"><button class="game-back" aria-label="返回关卡选择">// 设备修复</button><div class="game-heading"><span>源石电路模块 ${index+1}/${levels.length}</span><i></i></div><button class="repair-close" aria-label="退出修复">${iconClose}</button></header>
      <aside class="repair-instructions"><h2>${moduleCode(level)}</h2><div class="instruction-panel"><h3>▪ 拖拽元件到网格内完成修复</h3><p><kbd>↖</kbd> 拖拽移动元件</p><p><kbd>R</kbd> 旋转元件</p><p><kbd>TAB</kbd> 切换显示模式</p><p><kbd>ESC</kbd> 放弃修复</p></div><div class="repair-clock"><span>修复用时</span><time>00:00.00</time><small>${validRecord(level.id)?'最佳 '+formatTime(validRecord(level.id)):'尚无通关记录'}</small></div></aside>
      <div class="board-stage" style="--n:${level.size}"><div class="column-counts" aria-label="每列目标"></div><div class="row-counts" aria-label="每行目标"></div><div class="repair-board" tabindex="0" role="group" aria-label="${level.size}行${level.size}列修复棋盘，选择元件后用方向键移动，R旋转，回车放置"><div class="board-cells">${Array.from({length:level.size**2},(_,i)=>{const x=i%level.size,y=Math.floor(i/level.size),b=(level.blocked||[]).some(c=>c[0]===x&&c[1]===y);return `<span class="board-cell ${b?'blocked':''}" aria-label="${y+1}行${x+1}列${b?'障碍格':''}">${b?'<i>⊘</i>':'<i></i>'}</span>`;}).join('')}</div><div class="fixed-layer"></div><div class="placed-layer"></div><div class="preview-layer"></div><i class="board-corner c1"></i><i class="board-corner c2"></i><i class="board-corner c3"></i><i class="board-corner c4"></i></div></div>
      <aside class="parts-panel" aria-label="可用元件"><div class="parts-heading"><span class="parts-logo">▪<br>▪▪</span><span>元件库</span><small></small></div><div class="parts-tray"></div></aside>
      <div class="game-bottom"><button class="game-reset">重置 <span>⟲</span></button><div class="display-bar"><span class="bottom-rule"></span><div class="display-mode"><kbd>TAB</kbd><button data-mode="graphic" class="active">图形</button><button data-mode="numeric">数字</button></div><span class="bottom-rule"></span></div><div class="aux-controls"><button class="rotate-button" title="旋转元件 (R)">旋转 <b>R</b></button><button class="sound-button" aria-pressed="${!audio.muted}" aria-label="切换音效">${audio.muted?'音效 关':'音效 开'}</button></div></div><p class="game-live" aria-live="polite"></p><div class="repair-result" hidden></div>`;
    host.querySelector('.game-back').onclick=showLevels;host.querySelector('.repair-close').onclick=showLevels;
    host.querySelector('.game-reset').onclick=()=>{sound('ui');startLevel(current);};
    host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode==='numeric',true));
    host.querySelector('.rotate-button').onclick=rotateActive;
    host.querySelector('.sound-button').onclick=e=>{audio.setMuted(!audio.muted);e.currentTarget.textContent=audio.muted?'音效 关':'音效 开';e.currentTarget.setAttribute('aria-pressed',String(!audio.muted));if(!audio.muted)sound('ui');};
    host.querySelector('.repair-board').addEventListener('pointerdown',onBoardDown);
    renderFixed();renderPieces();setMode(numeric);layoutCustomGame();startTime=performance.now();tick();
  }
  function tick(){if(screen!=='game'||finished)return;host.querySelector('time').textContent=formatTime(performance.now()-startTime);raf=requestAnimationFrame(tick);}
  function renderFixed(){host.querySelector('.fixed-layer').innerHTML=(levels[current].fixed||[]).map(([x,y,color])=>`<div class="fixed-cell ${color}" style="left:${x*100/levels[current].size}%;top:${y*100/levels[current].size}%"><svg viewBox="0 0 40 40" aria-label="锁定格"><path d="M13 18v-5a7 7 0 0 1 14 0v5h3v17H10V18zm4 0h6v-5a3 3 0 0 0-6 0z"/></svg></div>`).join('');}
  function renderPieces(){
    const n=levels[current].size;
    host.querySelector('.placed-layer').innerHTML=pieces.filter(p=>p.x!==null).map(p=>{const w=Math.max(...p.cells.map(c=>c[0]))+1,h=Math.max(...p.cells.map(c=>c[1]))+1;return `<div class="placed-piece ${p.id===selected?'is-selected':''}" data-piece="${p.id}" style="left:${p.x/n*100}%;top:${p.y/n*100}%;width:${w/n*100}%;height:${h/n*100}%">${shapeSVG(p.cells,p.color)}</div>`;}).join('');
    host.querySelector('.parts-tray').innerHTML=pieces.map(p=>`<button class="part-slot ${p.x!==null||drag?.id===p.id?'used':''}" data-piece="${p.id}" aria-label="${colorName(p.color)}元件 ${p.id+1}，${p.cells.length}格${p.x!==null?'，已放置':''}" ${p.x!==null||drag?.id===p.id?'disabled':''}><span class="slot-corners"></span>${p.x===null&&drag?.id!==p.id?shapeSVG(p.cells,p.color):''}</button>`).join('');
    host.querySelectorAll('.part-slot:not(:disabled)').forEach(slot=>{slot.onpointerdown=e=>beginDrag(e,Number(slot.dataset.piece));slot.onkeydown=e=>{if(['Enter','Space'].includes(controlKey(e))){e.preventDefault();beginKeyboard(Number(slot.dataset.piece));}};});
    host.querySelector('.parts-heading small').textContent=`${pieces.filter(p=>p.x===null&&p.id!==drag?.id).length} / ${pieces.length}`;updateCounts();
  }
  function updateCounts(candidate){
    const level=levels[current],list=candidate?pieces.map(p=>p.id===candidate.id?candidate:p):pieces,actual=C.counts(level,list);
    for(const [axis,selector] of [['cols','.column-counts'],['rows','.row-counts']]){
      host.querySelector(selector).innerHTML=Array.from({length:level.size},(_,i)=>`<div class="count-group">${Object.keys(level[axis]).every(color=>level[axis][color][i]===0&&actual[axis][color][i]===0)?'<span class="count-zero" aria-label="目标为零">⊘</span>':''}${Object.keys(level[axis]).map(color=>{const target=level[axis][color][i],count=actual[axis][color][i];if(target===0&&count===0)return '';const bits=C.indicators(target,count);return `<span class="count-color ${color} ${count===target?'matched':''} ${count>target?'over':''}" aria-label="${axis==='rows'?'第'+(i+1)+'行':'第'+(i+1)+'列'}${colorName(color)}，当前${count}，目标${target}"><span class="count-bars">${bits.map(kind=>`<i class="count-unit count-${kind}"></i>`).join('')}</span><span class="count-number"><b>${count}</b><em>/${target}</em></span></span>`;}).join('')}</div>`).join('');
    }
  }
  function setMode(value,feedback=false){const changed=numeric!==value;numeric=value;host.classList.toggle('numeric-mode',numeric);host.querySelectorAll('[data-mode]').forEach(b=>{const on=(b.dataset.mode==='numeric')===numeric;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});if(changed&&feedback)sound('mode');}
  function onBoardDown(event){
    if(finished)return;
    const r=host.querySelector('.repair-board').getBoundingClientRect(),s=r.width/levels[current].size,x=Math.floor((event.clientX-r.left)/s),y=Math.floor((event.clientY-r.top)/s),p=pieces.find(p=>p.x!==null&&p.cells.some(([cx,cy])=>p.x+cx===x&&p.y+cy===y));
    if(p)beginDrag(event,p.id);
  }
  function beginDrag(event,id){
    if(finished||drag||event.button!==0)return;event.preventDefault();
    const p=pieces[id],original={...p,cells:p.cells.map(c=>[...c])};
    const anchor=C.centerCell(p.cells);
    drag={id,original,anchor,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,keyboard:false};p.x=null;p.y=null;selected=id;
    makeGhost();renderPieces();moveDrag(event.clientX,event.clientY);sound('pick');host.querySelector('.repair-board').focus({preventScroll:true});document.body.classList.add('dragging-circuit');
  }
  function beginKeyboard(id){
    if(finished||drag)return;
    const p=pieces[id];drag={id,original:{...p,cells:p.cells.map(c=>[...c])},anchor:C.centerCell(p.cells),keyboard:true,x:p.x??0,y:p.y??0};p.x=null;p.y=null;selected=id;makeGhost();renderPieces();positionKeyboard();host.querySelector('.repair-board').focus();sound('pick');announce('已选择元件。方向键移动，R旋转，回车放置，Escape取消。');
  }
  function makeGhost(){
    const p=pieces[drag.id],ghost=document.createElement('div');ghost.className='drag-piece';
    drag.visualAnchor=[...drag.anchor];drag.visualWidth=Math.max(...p.cells.map(c=>c[0]))+1;drag.visualHeight=Math.max(...p.cells.map(c=>c[1]))+1;drag.angle=0;
    ghost.innerHTML=`<div class="drag-rotation">${shapeSVG(p.cells,p.color,'lifted')}</div>`;
    // Exact cell-sized SVG coordinates keep the occupied square's center on the pivot.
    ghost.querySelector('svg').setAttribute('viewBox',`0 0 ${drag.visualWidth*100} ${drag.visualHeight*100}`);
    document.body.append(ghost);
  }
  function moveDrag(clientX,clientY){
    if(!drag)return;drag.clientX=clientX;drag.clientY=clientY;
    const r=host.querySelector('.repair-board').getBoundingClientRect(),s=r.width/levels[current].size;
    drag.x=Math.floor((clientX-r.left)/s)-drag.anchor[0];drag.y=Math.floor((clientY-r.top)/s)-drag.anchor[1];
    const p=pieces[drag.id],w=Math.max(...p.cells.map(c=>c[0]))+1,h=Math.max(...p.cells.map(c=>c[1]))+1,ghost=document.querySelector('.drag-piece');
    ghost.style.width=`${w*s}px`;ghost.style.height=`${h*s}px`;ghost.style.left=`${clientX-(drag.anchor[0]+.5)*s}px`;ghost.style.top=`${clientY-(drag.anchor[1]+.5)*s}px`;
    const visual=ghost.querySelector('.drag-rotation');
    visual.style.width=`${drag.visualWidth*s}px`;visual.style.height=`${drag.visualHeight*s}px`;
    visual.style.left=`${(drag.anchor[0]-drag.visualAnchor[0])*s}px`;visual.style.top=`${(drag.anchor[1]-drag.visualAnchor[1])*s}px`;
    visual.style.transformOrigin=`${(drag.visualAnchor[0]+.5)*s}px ${(drag.visualAnchor[1]+.5)*s}px`;
    visual.style.transform=`rotate(${drag.angle}deg)`;preview();
  }
  function positionKeyboard(){const r=host.querySelector('.repair-board').getBoundingClientRect(),s=r.width/levels[current].size;moveDrag(r.left+(drag.x+drag.anchor[0]+.5)*s,r.top+(drag.y+drag.anchor[1]+.5)*s);}
  function preview(){
    const level=levels[current],p=pieces[drag.id],n=level.size;drag.valid=C.canPlace(level,pieces,p,drag.x,drag.y);
    const intersects=p.cells.some(([x,y])=>x+drag.x>=0&&x+drag.x<n&&y+drag.y>=0&&y+drag.y<n),w=Math.max(...p.cells.map(c=>c[0]))+1,h=Math.max(...p.cells.map(c=>c[1]))+1;
    host.querySelector('.preview-layer').innerHTML=intersects?`<div class="snap-preview ${drag.valid?'valid':'invalid'}" style="left:${drag.x/n*100}%;top:${drag.y/n*100}%;width:${w/n*100}%;height:${h/n*100}%">${shapeSVG(p.cells,p.color)}</div>`:'';updateCounts(drag.valid?{...p,x:drag.x,y:drag.y}:null);
  }
  function rotateActive(targetId=null){
    if(finished||screen!=='game')return;
    if(!drag){
      const hovered=host.querySelector('.part-slot:hover:not(:disabled),.placed-piece:hover'),focused=document.activeElement?.closest('.part-slot:not(:disabled)'),id=Number.isInteger(targetId)?targetId:hovered?Number(hovered.dataset.piece):focused?Number(focused.dataset.piece):selected;
      if(id===null||!pieces[id]){announce('先选择一个元件，再旋转。');return;}
      const p=pieces[id],cells=C.rotate(p.cells);
      if(p.x!==null&&!C.canPlace(levels[current],pieces,{...p,cells},p.x,p.y)){sound('invalid');announce('旋转空间不足，请拖起元件后旋转。');return;}
      p.cells=cells;selected=id;renderPieces();sound('rotate');
      if(p.x===null)host.querySelector(`.part-slot[data-piece="${id}"]`).focus({preventScroll:true});else if(C.solved(levels[current],pieces))complete();return;
    }
    const p=pieces[drag.id],h=Math.max(...p.cells.map(c=>c[1]))+1;
    drag.anchor=[h-1-drag.anchor[1],drag.anchor[0]];p.cells=C.rotate(p.cells);drag.angle+=90;
    // Preserve the same screen-space pivot for mouse, touch and keyboard rotations.
    // Reusing the visual lets rapid turns continue from the current animated angle.
    moveDrag(drag.clientX,drag.clientY);sound('rotate');
  }
  function drop(){
    if(!drag)return;const p=pieces[drag.id],id=p.id;
    if(drag.valid){p.x=drag.x;p.y=drag.y;sound('drop');announce('元件已放置。');}
    else {const r=host.querySelector('.repair-board').getBoundingClientRect(),outside=drag.clientX<r.left||drag.clientX>r.right||drag.clientY<r.top||drag.clientY>r.bottom;
      if(outside&&!drag.keyboard){p.x=null;p.y=null;sound('ui');announce('元件已退回元件库。');}
      else {Object.assign(p,drag.original);sound('invalid');announce('无法放置：请避开其他元件、锁定格与障碍格。');}
    }
    endDrag();renderPieces();const placed=host.querySelector(`.placed-piece[data-piece="${id}"]`);if(placed)placed.classList.add('just-placed');if(C.solved(levels[current],pieces))complete();
  }
  function endDrag(){drag=null;document.querySelector('.drag-piece')?.remove();document.body.classList.remove('dragging-circuit');host.querySelector('.preview-layer')?.replaceChildren();}
  function cancelDrag(){if(!drag)return;Object.assign(pieces[drag.id],drag.original);endDrag();if(screen==='game'&&host.querySelector('.parts-tray'))renderPieces();}
  function announce(message){const live=host.querySelector('.game-live');if(live)live.textContent=message;}
  function complete(){
    finished=true;cancelAnimationFrame(raf);const elapsed=performance.now()-startTime,level=levels[current],previous=validRecord(level.id),isBest=!previous||elapsed<previous;
    host.querySelector('time').textContent=formatTime(elapsed);records[level.id]=C.bestTime(previous,elapsed);let saved=true;try{localStorage.setItem(STORAGE,JSON.stringify(records));}catch{saved=false;}
    host.querySelector('.repair-board').classList.add('board-complete');sound('success');host.querySelector('.parts-tray').inert=true;
    completionTimer=setTimeout(()=>{
      if(screen!=='game')return;const result=host.querySelector('.repair-result');result.hidden=false;
      result.innerHTML=`<div class="result-shade"></div><div class="result-content" role="dialog" aria-modal="true" aria-labelledby="repair-success-title"><div class="success-banner"><span></span><h2 id="repair-success-title">模块已修复</h2><span></span></div><div class="result-timing"><p>修复用时</p><strong>${formatTime(elapsed)}</strong><small>${isBest?'新最佳纪录':'最佳 '+formatTime(records[level.id])}</small></div><div class="result-actions"><button data-exit>退出修复</button><button data-next>修复下一模块 <span>›</span></button></div>${!saved?'<p class="storage-message">浏览器未允许保存，纪录仅保留在本次打开期间。</p>':''}</div>`;
      host.querySelectorAll('.game-header,.repair-instructions,.board-stage,.parts-panel,.game-bottom').forEach(el=>el.inert=true);result.querySelector('[data-exit]').onclick=showLevels;result.querySelector('[data-next]').onclick=()=>{sound('level');startLevel((current+1)%levels.length);};result.querySelector('[data-next]').focus();
    },650);
  }
  window.addEventListener('pointermove',e=>{if(drag&&!drag.keyboard&&e.pointerId===drag.pointerId){e.preventDefault();moveDrag(e.clientX,e.clientY);}},{passive:false});
  window.addEventListener('pointerup',e=>{if(drag&&!drag.keyboard&&e.pointerId===drag.pointerId&&e.button===0&&!(e.buttons&1))drop();});
  host.addEventListener('contextmenu',e=>{if(screen!=='game'||finished)return;e.preventDefault();const target=e.target.closest('[data-piece]');rotateActive(target?Number(target.dataset.piece):null);});
  window.addEventListener('pointercancel',cancelDrag);window.addEventListener('blur',()=>{if(drag)cancelDrag();});window.addEventListener('resize',()=>{if(drag)cancelDrag();layoutCustomGame();});
  const heldKeys=new Set();
  function controlKey(e){
    const codes=['KeyR','Tab','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Space'];
    if(codes.includes(e.code))return e.code;
    const legacy={9:'Tab',13:'Enter',27:'Escape',32:'Space',37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',82:'KeyR'};
    return legacy[e.keyCode]||legacy[e.which]||(e.key?.toLowerCase()==='r'?'KeyR':e.key===' '?'Space':e.key);
  }
  function handleControl(e,key){
    if(screen==='home'||screen==='custom')return;
    if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]')||e.ctrlKey||e.metaKey||e.altKey)return;
    if(key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(drag)cancelDrag();else if(screen==='levels')home();else showLevels();return;}
    if(screen!=='game')return;
    if(finished){if(key==='Tab'){const buttons=[...host.querySelectorAll('.result-actions button')];if(buttons.length){e.preventDefault();buttons[(buttons.indexOf(document.activeElement)+1)%buttons.length].focus();}}return;}
    if(key==='KeyR'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)rotateActive();return;}
    if(key==='Tab'&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)setMode(!numeric,true);return;}
    if(drag?.keyboard){if(key?.startsWith('Arrow')){e.preventDefault();if(key==='ArrowLeft')drag.x--;if(key==='ArrowRight')drag.x++;if(key==='ArrowUp')drag.y--;if(key==='ArrowDown')drag.y++;drag.x=Math.max(-4,Math.min(levels[current].size,drag.x));drag.y=Math.max(-4,Math.min(levels[current].size,drag.y));positionKeyboard();}if(key==='Enter'||key==='Space'){e.preventDefault();drop();}}
  }
  window.addEventListener('keydown',e=>{const key=controlKey(e);if(key==='KeyR'||key==='Tab')heldKeys.add(key);handleControl(e,key);},true);
  // Some IMEs obscure keydown but expose the physical key on keyup. Handle that once.
  window.addEventListener('keyup',e=>{const key=controlKey(e);if(key!=='KeyR'&&key!=='Tab')return;if(!heldKeys.delete(key))handleControl(e,key);},true);
  window.addEventListener('blur',()=>heldKeys.clear());
  window.RepairGame={open:showLevels};
})();
