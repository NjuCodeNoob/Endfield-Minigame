(() => {
  'use strict';
  const C=SalvageCore,levels=[...SalvageLevels],audio=window.TerminalAudio;
  let L=levels[0],current=0,renderer=null,clock=0,started=0,resultMs=0,records={},saved=true;
  const STORAGE='endfield.salvage.records.v1';
  try{const data=JSON.parse(localStorage.getItem(STORAGE)||'{}');if(data&&typeof data==='object')records=data;}catch{}
  const best=id=>Number.isFinite(records[id])&&records[id]>0?records[id]:null;
  const grade=lift=>lift===6?4:lift;
  const format=ms=>{const c=Math.floor(ms/10);return `${String(Math.floor(c/6000)).padStart(2,'0')}:${String(Math.floor(c/100)%60).padStart(2,'0')}.${String(c%100).padStart(2,'0')}`;};
  function cleanScene(){renderer?.dispose();renderer=null;clearInterval(clock);clock=0;}
  const host=document.createElement('section');host.id='salvage-app';host.hidden=true;host.setAttribute('aria-label','浮空回收');document.body.append(host);
  const balloonIcon='<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="15" cy="13" rx="11" ry="13" fill="currentColor"/><path d="M9 29h12v10H9zM29 13l9 13h-6v13h-6V26h-6z" fill="currentColor"/></svg>';
  const medal=(value)=>`<svg class="salvage-medal value-${value}" viewBox="0 0 100 100" aria-hidden="true"><circle class="medal-shadow" cx="50" cy="52" r="45"/><circle class="medal-rim" cx="50" cy="48" r="43"/><circle class="medal-inner" cx="50" cy="48" r="37"/><circle class="medal-center" cx="50" cy="48" r="29"/><path class="medal-stripes" d="m48 73 23-24m-16 25 19-21m-11 19 13-14"/><text x="46" y="63" text-anchor="middle">${value}</text><path class="medal-arrow" d="m60 27 7 10h-4v17h-6V37h-4z"/></svg>`;
  const plate='M4 4H16V12H64V4H76V76H64V68H16V76H4Z';
  const closeIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 10L22 22M22 10L10 22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"/></svg>';
  const resetIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 11a10 10 0 1 1-1 9M7 4v8h8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 13h6v6h-6z" fill="currentColor" opacity=".65"/></svg>';
  let items=C.initial(),drag=null,selected=null,phase='closed',ready=false,timers=[];
  const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
  function clearTimers(){timers.forEach(clearTimeout);timers=[];}
  function cancelDrag(){if(drag){drag.ghost.remove();drag=null;}host.classList.remove('is-dragging');host.querySelectorAll('.drag-origin').forEach(el=>el.classList.remove('drag-origin'));}
  function close(){cleanScene();clearTimers();cancelDrag();selected=null;phase='closed';host.hidden=true;host.innerHTML='';audio.stopGameplay();document.querySelector('.terminal').inert=false;document.querySelector('[data-module="salvage"]').focus();}
  function startLevel(index=0){
    cleanScene();audio.stopGameplay();current=Math.max(0,Math.min(levels.length-1,index));L=levels[current];clearTimers();cancelDrag();items=C.initial(L);selected=null;ready=false;phase='playing';host.hidden=false;host.className='';document.querySelector('.terminal').inert=true;
    host.innerHTML=`<div class="salvage-haze" aria-hidden="true"></div><header class="salvage-header"><span>// 浮空回收</span><h1>待回收物品 <b>${L.stage}/${L.total}</b></h1><button class="salvage-close" aria-label="返回关卡选择">✕</button></header><div class="salvage-frame"><i class="salvage-cross top-left"></i><i class="salvage-cross top-right"></i><i class="salvage-cross bottom-left"></i><i class="salvage-cross bottom-right"></i><aside class="salvage-instructions"><h2>${balloonIcon} ${CustomSalvageUI.escape(L.code)}</h2><div class="salvage-tricolor"></div><p>▪ 放置所有气球并保持平衡</p><p class="muted">◎ 气球放置位置</p><p>▪ 气球操作提示</p><p class="muted"><span class="salvage-mouse"></span> 拖拽移动气球</p><div class="salvage-clock"><span>回收计时</span><b>00:00.00</b><small>${best(L.id)?'最佳 '+format(best(L.id)):'尚无回收记录'}</small></div></aside><main class="salvage-stage"><h2 class="salvage-achieved">回收条件达成</h2><div class="salvage-scan"></div><svg class="salvage-board" viewBox="0 0 600 600" aria-label="5乘5回收面板"><g class="salvage-platform"><g class="salvage-lift" transform="translate(215 33)"><path d="M0 0H170V32H0Z"/><text x="85" y="24" text-anchor="middle">0/4</text></g><g class="salvage-tiles"></g><g class="salvage-moments"></g><path class="salvage-corners" d="M90 90h5v5h-5zM505 90h5v5h-5zM90 505h5v5h-5zM505 505h5v5h-5z"/><g class="salvage-axes"></g><g class="salvage-attached"></g></g></svg><div class="salvage-live sr-only" aria-live="polite"></div><p class="salvage-recovering">· 气球部署就绪 ·</p></main><aside class="salvage-inventory"><h2>${balloonIcon} 回收需使用全部气球</h2><div class="salvage-tray"></div></aside></div><footer class="salvage-footer"><button class="salvage-reset">${balloonIcon}<span>重置</span><b>≫</b></button><div class="salvage-legend"><span>xxx　 ▫ ▫ ▧ //　⬆区域升力倍率　// ▧ ▫ ▫　 xxx</span><div>${[0,1,2].map(n=>`<span><svg viewBox="0 0 80 80"><path d="${plate}" fill="${['#818382','#535552','#373938'][n]}"/><circle cx="40" cy="40" r="6"/></svg> ×${n}</span>`).join('')}</div></div><div class="salvage-submit-wrap"><p class="salvage-status"></p><button class="salvage-submit" disabled><span>⟷</span> 完成回收 <b>⊘</b></button></div></footer><div class="salvage-result" hidden>${balloonIcon}<h2>回收成功</h2><small>RECOVERY COMPLETE</small><p class="salvage-result-time"></p><p class="salvage-storage-notice"></p><div><button data-result="home">退出回收</button><button data-result="again">再次回收</button>${current<levels.length-1?'<button data-result="next">回收下一模块 ›</button>':''}</div></div>`;
    const wave=document.createElementNS('http://www.w3.org/2000/svg','svg');wave.setAttribute('viewBox','0 0 1200 500');wave.setAttribute('class','salvage-waves');wave.setAttribute('aria-hidden','true');
    wave.innerHTML=Array.from({length:36},(_,i)=>`<path d="M-40 ${235+i*5} C100 ${70+i*6},180 ${400-i*3},310 ${260+i*3} S500 ${90+i*6},610 ${220+i*5} S800 ${420-i*3},920 ${250+i*4} S1100 ${60+i*7},1240 ${200+i*5}"/>`).join('');host.querySelector('.salvage-stage').prepend(wave);
    const tiles=host.querySelector('.salvage-tiles');
    host.querySelector('.salvage-close').innerHTML=closeIcon;host.querySelector('.salvage-reset svg').outerHTML=resetIcon;
    tiles.innerHTML=Array.from({length:25},(_,i)=>{const x=i%5,y=Math.floor(i/5),socket=L.sockets.some(s=>s[0]===x&&s[1]===y),ring=Math.max(Math.abs(x-2),Math.abs(y-2));return `<g class="salvage-cell ring-${ring} ${socket?'socket':''}" data-x="${x}" data-y="${y}" transform="translate(${100+x*80} ${100+y*80})" ${socket?'tabindex="0" role="button"':''} aria-label="第${y+1}行第${x+1}列${socket?'气球放置位置':''}"><path d="${plate}"/>${socket?'<circle cx="40" cy="40" r="7"/><circle class="socket-dot" cx="40" cy="40" r="4"/>':''}</g>`;}).join('');
    host.querySelector('.salvage-close').onclick=()=>{audio.play('ui');showLevels();};
    host.querySelector('.salvage-reset').onclick=()=>{if(phase!=='playing')return;audio.play('ui');cancelDrag();selected=null;items=C.initial(L);started=performance.now();update();};
    host.querySelector('.salvage-submit').onclick=finish;
    host.querySelector('[data-result="home"]').onclick=showLevels;
    host.querySelector('[data-result="again"]').onclick=()=>{audio.play('level');startLevel(current);};
    const next=host.querySelector('[data-result="next"]');if(next)next.onclick=()=>{audio.play('level');startLevel(current+1);};
    const construction=document.createElementNS('http://www.w3.org/2000/svg','g');construction.setAttribute('class','salvage-construction');construction.setAttribute('aria-hidden','true');construction.innerHTML=Array.from({length:6},(_,i)=>`<path d="M${100+i*80} -50V500" style="animation-delay:${i*35}ms"/>`).join('');host.querySelector('.salvage-board').prepend(construction);
    host.querySelectorAll('.salvage-cell').forEach((el,i)=>el.style.setProperty('--tile-delay',`${i*9}ms`));
    renderer=Salvage3D.create(host.querySelector('.salvage-board'),L);
    started=performance.now();clock=setInterval(()=>{const el=host.querySelector('.salvage-clock b');if(el)el.textContent=format(performance.now()-started);},50);
    update();host.querySelector('.salvage-close').focus();
  }
  function update(){
    const s=C.evaluate(L,items),wasReady=ready;ready=s.ready;host.classList.toggle('is-ready',ready);
    const lift=host.querySelector('.salvage-lift');lift.classList.toggle('enough',s.lift>=L.lift);lift.querySelector('text').textContent=`${s.lift}/${L.lift}`;
    host.querySelector('.salvage-tray').innerHTML=[...new Set(L.balloons.map(b=>b.lift))].map(value=>{const remaining=items.filter(b=>b.lift===value&&b.x===null),id=remaining[0]?.id;return `<button class="salvage-stock ${selected!==null&&id===selected?'chosen':''}" data-id="${id??''}" ${remaining.length?'':'disabled'} aria-label="${grade(value)}级回收气球，剩余${remaining.length}个"><span class="salvage-stock-icon">${medal(value)}<b>${remaining.length}</b></span><span><strong>${grade(value)}级回收气球</strong><small>[升力 ··· <b>${value}⬆</b>]</small></span></button>`;}).join('');
    host.querySelector('.salvage-attached').innerHTML=items.filter(b=>b.x!==null).map(b=>`<g class="salvage-balloon ${selected===b.id?'chosen':''}" data-id="${b.id}" tabindex="0" role="button" aria-label="${grade(b.lift)}级气球，第${b.y+1}行第${b.x+1}列" transform="translate(${98+b.x*80} ${98+b.y*80})"><svg width="84" height="84" viewBox="0 0 100 100">${medal(b.lift).replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg></g>`).join('');
    host.querySelectorAll('.salvage-balloon').forEach(el=>el.classList.add(`value-${items.find(b=>b.id===+el.dataset.id).lift}`));
    renderer?.update(items,s);
    host.querySelector('.salvage-status').textContent=s.lift<L.lift?'xxx 回收升力不足 xxx':!s.all?'xxx 需使用全部气球 xxx':!s.balanced?'xxx 未达到平衡 xxx':'';
    const submit=host.querySelector('.salvage-submit');submit.disabled=!ready;submit.querySelector('b').textContent=ready?'▣':'⊘';
    host.querySelector('.salvage-reset').disabled=!s.placed;
    host.querySelector('.salvage-live').textContent=`升力 ${s.lift}/${L.lift}，左右力矩 ${s.horizontal}，上下力矩 ${s.vertical}。${ready?'回收条件达成':''}`;
    if(ready&&!wasReady){audio.play('salvage-ready');host.querySelector('.salvage-scan').classList.remove('run');void host.querySelector('.salvage-scan').offsetWidth;host.querySelector('.salvage-scan').classList.add('run');}
  }
  function cellAt(x,y){return renderer?.hit(x,y)||null;}
  function highlight(cell){host.querySelectorAll('.salvage-cell').forEach(el=>{const hover=cell&&+el.dataset.x===cell[0]&&+el.dataset.y===cell[1];el.classList.toggle('hover-valid',!!hover&&C.canDrop(L,items,drag?.id??selected,...cell));el.classList.toggle('hover-invalid',!!hover&&!C.canDrop(L,items,drag?.id??selected,...cell));});}
  function begin(event,id){
    if(phase!=='playing'||drag||event.button!==0||!Number.isInteger(id)||!items.some(b=>b.id===id))return;
    event.preventDefault();selected=id;audio.play('salvage-pick');
    const ghost=document.createElement('div');ghost.className='salvage-drag';ghost.innerHTML=medal(items.find(b=>b.id===id).lift);const rect=host.querySelector('.salvage-board').getBoundingClientRect();ghost.style.width=`${rect.width*84/600}px`;document.body.append(ghost);
    drag={id,pointer:event.pointerId,ghost,startX:event.clientX,startY:event.clientY,moved:false};host.classList.add('is-dragging');ghost.style.left=`${event.clientX}px`;ghost.style.top=`${event.clientY}px`;
    host.querySelector(`.salvage-balloon[data-id="${id}"]`)?.classList.add('drag-origin');
  }
  host.addEventListener('pointerdown',event=>{const source=event.target.closest('.salvage-stock:not(:disabled),.salvage-balloon');if(source)begin(event,Number(source.dataset.id));});
  window.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointer)return;drag.moved ||= Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>5;drag.ghost.style.left=`${event.clientX}px`;drag.ghost.style.top=`${event.clientY}px`;const cell=cellAt(event.clientX,event.clientY);highlight(cell);const key=cell?.join(',')||'';if(key!==drag.previewKey){drag.previewKey=key;let preview=C.remove(items,drag.id);if(cell&&C.canDrop(L,items,drag.id,...cell))preview=C.drop(L,items,drag.id,...cell);const stats=C.evaluate(L,preview);renderer?.preview(stats);const badge=host.querySelector('.salvage-lift');badge.classList.toggle('enough',stats.lift>=L.lift);badge.querySelector('text').textContent=`${stats.lift}/${L.lift}`;}});
  window.addEventListener('pointerup',event=>{
    if(!drag||event.pointerId!==drag.pointer||event.button!==0)return;
    const {id,moved}=drag,cell=cellAt(event.clientX,event.clientY),tray=host.querySelector('.salvage-inventory').getBoundingClientRect();cancelDrag();highlight(null);
    if(cell&&C.canDrop(L,items,id,...cell)){items=C.drop(L,items,id,...cell);selected=null;audio.play('salvage-drop');}
    else if(moved&&event.clientX>=tray.left&&event.clientX<=tray.right&&event.clientY>=tray.top&&event.clientY<=tray.bottom){items=C.remove(items,id);selected=null;audio.play('salvage-pick');}
    else if(moved){selected=null;audio.play('invalid');}
    update();
  });
  window.addEventListener('pointercancel',()=>{if(drag){cancelDrag();highlight(null);selected=null;update();}});
  window.addEventListener('blur',()=>{if(drag){cancelDrag();highlight(null);selected=null;update();}});
  function activate(target){
    const source=target.closest('.salvage-stock:not(:disabled),.salvage-balloon'),cell=target.closest('.salvage-cell.socket');
    if(source){selected=Number(source.dataset.id);audio.play('salvage-pick');update();}
    else if(cell&&selected!==null){const x=+cell.dataset.x,y=+cell.dataset.y;if(C.canDrop(L,items,selected,x,y)){items=C.drop(L,items,selected,x,y);selected=null;audio.play('salvage-drop');update();}else audio.play('invalid');}
  }
  host.addEventListener('click',event=>{if(phase==='playing'&&!drag&&event.target.closest('.salvage-cell.socket'))activate(event.target);});
  host.addEventListener('keydown',event=>{if(phase!=='playing'||event.target.matches('input,select,textarea'))return;if(['Enter','Space'].includes(event.code)&&event.target.closest('.salvage-stock,.salvage-balloon,.salvage-cell.socket')){event.preventDefault();activate(event.target);}if(['Delete','Backspace'].includes(event.code)&&selected!==null){event.preventDefault();items=C.remove(items,selected);selected=null;update();}});
  document.addEventListener('keydown',event=>{if(phase==='closed'||phase==='custom'||event.code!=='Escape')return;event.preventDefault();if(drag){cancelDrag();highlight(null);selected=null;update();}else if(phase==='levels')close();else showLevels();});
  function finish(){
    if(phase!=='playing'||!C.evaluate(L,items).ready)return;phase='recovering';resultMs=Math.max(1,performance.now()-started);clearInterval(clock);clock=0;const previous=best(L.id);records[L.id]=previous?Math.min(previous,resultMs):resultMs;saved=true;try{localStorage.setItem(STORAGE,JSON.stringify(records));}catch{saved=false;}cancelDrag();selected=null;host.classList.add('is-recovering');audio.play('salvage-launch');
    host.querySelector('.salvage-submit').disabled=true;host.querySelector('.salvage-reset').disabled=true;
    later(()=>{host.classList.add('is-recovered');audio.play('salvage-success');host.querySelector('.salvage-result').hidden=false;host.querySelector('.salvage-result-time').textContent=`用时 ${format(resultMs)}　/　最佳 ${format(best(L.id))}`;host.querySelector('.salvage-storage-notice').textContent=saved?'':'浏览器未允许保存，记录仅保留在本次打开期间。';host.querySelector('[data-result="home"]').focus();phase='complete';},3400);
  }
  function showLevels(){
    levels.splice(SalvageLevels.length,levels.length-SalvageLevels.length,...CustomSalvage.read(localStorage));current=Math.min(current,levels.length-1);
    cleanScene();clearTimers();cancelDrag();audio.stopGameplay();phase='levels';selected=null;host.hidden=false;host.className='salvage-selector';document.querySelector('.terminal').inert=true;
    const completed=levels.filter(l=>best(l.id)).length;
    host.innerHTML=`<div class="selector-noise"></div><header class="selector-header"><button class="selector-back" data-home aria-label="返回首页">‹</button><span>终末地模拟终端 <b>›</b> 浮空回收</span><button class="repair-close" data-home aria-label="返回首页">✕</button></header><div class="selector-content"><div class="selector-title"><div><p>RECOVERY TERMINAL / MODULE DIRECTORY</p><h2>选择回收模块<span>浮力平衡</span></h2></div><span class="completion-count">${completed}<small> / ${String(levels.length).padStart(2,'0')} 已回收</small></span></div><div class="level-grid">${levels.map((l,i)=>`${l.custom?'<div class="custom-card-wrap">':''}<button class="level-card ${best(l.id)?'cleared':''}" data-salvage-level="${i}"><span class="card-number">${String(i+1).padStart(2,'0')}</span><span class="card-code">${CustomSalvageUI.escape(l.code)}${l.total>1?' / '+l.stage+'-'+l.total:''}</span><span class="level-mini salvage-mini" style="--n:5" aria-hidden="true">${Array.from({length:25},(_,n)=>`<i class="${l.sockets.some(p=>p[0]===n%5&&p[1]===Math.floor(n/5))?'socket':''}"></i>`).join('')}</span><span class="card-title">${CustomSalvageUI.escape(l.name)}</span><span class="card-meta">5 × 5 <b>·</b> ${l.balloons.length} 气球 <b>·</b> 升力 ${l.lift}</span><span class="card-record">${best(l.id)?`<i>✓ 已回收</i><span>最佳 ${format(best(l.id))}</span>`:'<i>待回收</i><span>进入模块 ↗</span>'}</span></button>${l.custom?`<div class="custom-card-actions"><button data-salvage-seed="${i}">Seed</button><button data-salvage-delete="${i}">Delete</button></div></div>`:''}`).join('')}<button class="level-card" data-salvage-custom><span class="card-number">+</span><span class="card-code">CUSTOM MODULE</span><span class="card-title" data-custom-label></span><span class="card-meta" data-custom-detail></span></button></div><div class="selector-bottom"><span>部署气球 · 校准平衡 · 浮空回收</span><span>ENDFIELD / RECOVERY SYSTEM</span></div></div>`;
    bindCustom();
    host.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>{audio.play('ui');close();});
    host.querySelectorAll('[data-salvage-level]').forEach(b=>b.onclick=()=>{audio.play('level');startLevel(Number(b.dataset.salvageLevel));});
    host.querySelector(`[data-salvage-level="${current}"]`)?.focus({preventScroll:true});
  }
  function openCustom(l){cleanScene();clearTimers();cancelDrag();phase='custom';host.hidden=true;CustomSalvageUI.open({onClose(id,play){levels.splice(SalvageLevels.length,levels.length-SalvageLevels.length,...CustomSalvage.read(localStorage));const index=levels.findIndex(l=>l.id===id);if(play&&index>=0)startLevel(index);else showLevels();}},l);}
  function bindCustom(){
    host.querySelector('.repair-close').innerHTML=closeIcon;
    host.querySelector('[data-custom-label]').textContent='自定义';host.querySelector('[data-custom-detail]').textContent='创建关卡 · 导入关卡';host.querySelector('[data-salvage-custom]').onclick=()=>openCustom();
    host.querySelectorAll('[data-salvage-seed]').forEach(b=>{b.textContent='种子';b.onclick=()=>openCustom(levels[+b.dataset.salvageSeed]);});
    host.querySelectorAll('[data-salvage-delete]').forEach(b=>{b.textContent='删除';b.onclick=()=>{const l=levels[+b.dataset.salvageDelete];try{CustomSalvage.remove(localStorage,l.id);delete records[l.id];localStorage.setItem(STORAGE,JSON.stringify(records));showLevels();}catch{b.textContent='删除失败，请重试';}};});
  }
  window.SalvageGame={open:showLevels,start:startLevel,close};
})();
