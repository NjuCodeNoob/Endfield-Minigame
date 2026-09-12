(() => {
  const C=RepairCore,K=CustomRepair,labels={lime:'绿',blue:'蓝',amber:'黄'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let root=null,callbacks=null,draft=null,tool='piece',color='lime',shape=0,cells=[],anchor=[],hover=null,enabled=new Set(['lime']);
  function shell(title,body){
    root.innerHTML=`<header class="custom-header"><button data-back aria-label="返回关卡选择">‹ 返回</button><h2>${title}</h2><span>自定义 / 修复机器人</span></header>${body}`;
    root.querySelector('[data-back]').onclick=close;
  }
  function notice(message,error=false){const el=root.querySelector('.custom-notice');if(el){el.textContent=message;el.classList.toggle('error',error);}}
  function close(id,play=false){root?.remove();root=null;callbacks.onClose(typeof id==='string'?id:null,play);}
  function open(options){callbacks=options;root?.remove();root=document.createElement('section');root.id='custom-workbench';document.body.append(root);menu();}
  function menu(){
    shell('自定义',`<main class="custom-menu"><p class="custom-eyebrow">CUSTOM MODULE</p><h3>制作你的修复模块</h3><div class="custom-choices"><button data-create><b>＋</b><strong>创建关卡</strong><span>摆出可解布局，生成专属种子</span></button><button data-import><b>⌁</b><strong>导入关卡</strong><span>输入种子，还原并保存关卡</span></button></div><p>关卡和最佳时间保存在当前浏览器。复制种子即可在其他电脑导入。</p></main>`);
    root.querySelector('[data-create]').onclick=editor;
    root.querySelector('[data-import]').onclick=importer;
  }
  function importer(){
    shell('导入关卡',`<form class="custom-import"><label for="custom-seed-input">关卡种子</label><textarea id="custom-seed-input" rows="7" maxlength="20000" spellcheck="false" placeholder="粘贴 EFT1. 或 EFT2. 开头的完整种子" required></textarea><p>同一种子还原相同的名称、棋盘、元件和行列目标。导入成功后自动保存。</p><p class="custom-notice" role="status"></p><button class="custom-primary" type="submit">解析并保存</button></form>`);
    root.querySelector('form').onsubmit=e=>{e.preventDefault();try{result(K.decode(root.querySelector('textarea').value));}catch(error){notice(error.message,true);}};
    root.querySelector('textarea').focus();
  }
  function result(level){
    let saved=false;try{K.save(localStorage,level);saved=true;}catch{}
    shell('关卡种子',`<main class="custom-import"><p class="custom-eyebrow">${saved?'MODULE SAVED':'MODULE READY'}</p><h3>${esc(level.code)}</h3><p>${level.size} × ${level.size} · ${level.pieces.length} 元件 · ${Object.keys(level.rows).length} 种颜色</p><label for="custom-seed-output">复制种子，分享这道题</label><textarea id="custom-seed-output" rows="6" readonly spellcheck="false"></textarea><p class="custom-notice ${saved?'':'error'}" role="status">${saved?'关卡已保存；重复导入不会新增副本或覆盖最佳时间。':'浏览器未允许保存或空间不足。请先复制种子，再尝试保存。'}</p><div class="custom-actions"><button data-copy>复制种子</button><button data-retry ${saved?'hidden':''}>重试保存</button><button class="custom-primary" data-play ${saved?'':'disabled'}>开始挑战</button><button data-list>返回关卡选择</button></div></main>`);
    const area=root.querySelector('textarea');area.value=level.seed;
    root.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(level.seed);notice('种子已复制。');}catch{area.focus();area.select();notice('种子已选中，请按 Ctrl+C 或长按复制。');}};
    root.querySelector('[data-retry]').onclick=()=>result(level);
    root.querySelector('[data-play]').onclick=()=>close(level.id,true);
    root.querySelector('[data-list]').onclick=()=>close(level.id);
  }
  function editor(){
    draft={name:'Δ-我的关卡',size:5,blocked:[],fixed:[],pieces:[]};tool='piece';color='lime';shape=0;cells=K.SHAPES[0].map(c=>[...c]);anchor=C.centerCell(cells);hover=null;enabled=new Set(['lime']);
    shell('创建关卡',`<div class="custom-editor"><aside class="editor-settings"><label for="custom-name">关卡名称</label><div class="custom-name"><span>Δ-</span><input id="custom-name" value="我的关卡" maxlength="26" autocomplete="off"></div><small>含 Δ-，最多 15 字，可用中文</small><label for="custom-size">棋盘边长</label><select id="custom-size">${Array.from({length:13},(_,i)=>`<option value="${i+3}" ${i===2?'selected':''}>${i+3} × ${i+3}</option>`).join('')}</select><fieldset><legend>使用颜色（1–3 种）</legend>${K.COLORS.map(c=>`<label class="color-option"><input type="checkbox" data-enable="${c}" ${c==='lime'?'checked':''}><i class="swatch ${c}"></i>${labels[c]}色</label>`).join('')}</fieldset><div class="editor-tools"><button data-tool="piece" class="active">放置元件</button><button data-tool="block">阻挡块</button><button data-tool="fixed">固有块 🔒</button><button data-tool="erase">移除</button><button data-rotate>旋转 <kbd>R</kbd></button></div><p class="editor-help">选择形状后，点击棋盘放置。R 或右键旋转。“固有块”使用当前颜色，计入目标且不能移动；“移除”可删除元件、阻挡块或固有块。</p><p class="editor-stats"></p><button class="custom-primary" data-generate>生成种子并保存</button></aside><main class="editor-canvas"><div class="editor-board" role="group" aria-label="自定义关卡棋盘"></div><p class="custom-notice" role="status">先摆出一份解答，行列目标会根据布局自动生成。</p></main><aside class="editor-library"><h3>元件库</h3><div class="palette-colors"></div><div class="shape-palette"></div></aside></div>`);
    root.querySelector('#custom-name').oninput=e=>{draft.name='Δ-'+e.target.value;};
    root.querySelector('#custom-size').onchange=e=>{
      const n=Number(e.target.value);
      if([...draft.blocked,...draft.fixed.map(c=>c.slice(0,2)),...draft.pieces.flatMap(p=>p.cells)].some(c=>c[0]>=n||c[1]>=n)){e.target.value=draft.size;notice('缩小棋盘前，请先移除边界外的元件和阻挡块。',true);return;}
      draft.size=n;hover=null;renderBoard();
    };
    root.querySelectorAll('[data-enable]').forEach(input=>input.onchange=()=>{
      const c=input.dataset.enable;
      if(!input.checked&&(enabled.size===1||(draft.pieces.some(p=>p.color===c)||draft.fixed.some(f=>f[2]===c)))){input.checked=true;notice(enabled.size===1?'至少保留一种颜色。':'先移除棋盘上该颜色的元件及固有块，再关闭此颜色。',true);return;}
      if(input.checked)enabled.add(c);else enabled.delete(c);if(!enabled.has(color))color=[...enabled][0];palette();paintPreview();
    });
    root.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
    root.querySelector('[data-rotate]').onclick=rotate;
    root.querySelector('[data-generate]').onclick=()=>{try{result(K.create(draft));}catch(error){notice(error.message,true);}};
    const board=root.querySelector('.editor-board');
    board.onclick=e=>{const b=e.target.closest('[data-cell]');if(b)place(Number(b.dataset.cell));};
    board.onpointermove=e=>{const b=e.target.closest('[data-cell]');if(b){hover=Number(b.dataset.cell);paintPreview();}};
    board.onpointerleave=()=>{hover=null;paintPreview();};
    board.oncontextmenu=e=>{e.preventDefault();rotate();};
    board.onfocusin=e=>{const b=e.target.closest('[data-cell]');if(b){hover=Number(b.dataset.cell);paintPreview();}};
    board.onkeydown=e=>{
      if(!e.code?.startsWith('Arrow'))return;e.preventDefault();
      const now=Number(e.target.dataset.cell),delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-draft.size,ArrowDown:draft.size}[e.code];
      board.querySelector(`[data-cell="${Math.max(0,Math.min(draft.size**2-1,now+delta))}"]`)?.focus();
    };
    palette();renderBoard();
  }
  function setTool(value){tool=value;root.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});paintPreview();}
  function palette(){
    root.querySelector('.palette-colors').innerHTML=K.COLORS.filter(c=>enabled.has(c)).map(c=>`<button data-color="${c}" class="${c===color?'active':''}" aria-pressed="${c===color}"><i class="swatch ${c}"></i>${labels[c]}色</button>`).join('');
    root.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color;palette();setTool(tool==='fixed'?'fixed':'piece');});
    root.querySelector('.shape-palette').innerHTML=K.SHAPES.map((s,i)=>`<button data-shape="${i}" class="${shape===i?'active':''}" aria-label="形状 ${i+1}，${s.length} 格" aria-pressed="${shape===i}">${callbacks.shapeSVG(shape===i?cells:s,color)}<span>${String(i+1).padStart(2,'0')} / ${s.length} 格</span></button>`).join('');
    root.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{shape=Number(b.dataset.shape);cells=K.SHAPES[shape].map(c=>[...c]);anchor=C.centerCell(cells);palette();setTool('piece');});
  }
  function renderBoard(){
    const n=draft.size,board=root.querySelector('.editor-board');board.style.setProperty('--n',n);
    board.innerHTML=Array.from({length:n*n},(_,i)=>`<button data-cell="${i}" tabindex="${i===0?'0':'-1'}" aria-label="第 ${Math.floor(i/n)+1} 行第 ${i%n+1} 列"></button>`).join('')+'<div class="editor-pieces"></div><div class="editor-preview"></div>';
    renderLayout();
  }
  function renderLayout(){
    const board=root.querySelector('.editor-board'),n=draft.size;
    board.querySelectorAll('[data-cell]').forEach(b=>{const i=Number(b.dataset.cell),x=i%n,y=Math.floor(i/n),blocked=draft.blocked.some(c=>c[0]===x&&c[1]===y),fixed=draft.fixed.find(c=>c[0]===x&&c[1]===y),p=draft.pieces.find(p=>p.cells.some(c=>c[0]===x&&c[1]===y));b.classList.toggle('is-blocked',blocked);b.textContent=blocked?'⊘':'';b.setAttribute('aria-label',`第 ${y+1} 行第 ${x+1} 列${blocked?'，阻挡块':fixed?'，'+labels[fixed[2]]+'色固有块':p?'，'+labels[p.color]+'色元件':'，空格'}`);});
    board.querySelector('.editor-pieces').innerHTML=draft.pieces.map(p=>pieceMarkup(p.cells,p.color)).join('')+draft.fixed.map(([x,y,c])=>`<div class="fixed-cell ${c}" style="left:${x/n*100}%;top:${y/n*100}%"><svg viewBox="0 0 40 40" aria-label="固有块"><path d="M13 18v-5a7 7 0 0 1 14 0v5h3v17H10V18zm4 0h6v-5a3 3 0 0 0-6 0z"/></svg></div>`).join('');
    root.querySelector('.editor-stats').textContent=`${draft.pieces.length} 元件 · ${draft.blocked.length} 阻挡块 · ${draft.fixed.length} 固有块 · ${new Set([...draft.pieces.map(p=>p.color),...draft.fixed.map(c=>c[2])]).size} 种已用颜色`;
    paintPreview();
  }
  function pieceMarkup(absolute,color,extra=''){
    const x=Math.min(...absolute.map(c=>c[0])),y=Math.min(...absolute.map(c=>c[1])),s=C.normalize(absolute),w=Math.max(...s.map(c=>c[0]))+1,h=Math.max(...s.map(c=>c[1]))+1,n=draft.size;
    return `<div class="editor-piece ${extra}" style="left:${x/n*100}%;top:${y/n*100}%;width:${w/n*100}%;height:${h/n*100}%">${callbacks.shapeSVG(s,color)}</div>`;
  }
  function candidate(index){const a=anchor,x=index%draft.size-a[0],y=Math.floor(index/draft.size)-a[1];return cells.map(c=>[x+c[0],y+c[1]]);}
  function fits(absolute){const busy=new Set([...draft.blocked,...draft.fixed.map(c=>c.slice(0,2)),...draft.pieces.flatMap(p=>p.cells)].map(c=>c.join(',')));return absolute.every(c=>c[0]>=0&&c[1]>=0&&c[0]<draft.size&&c[1]<draft.size&&!busy.has(c.join(',')));}
  function paintPreview(){if(!root?.querySelector('.editor-preview'))return;const layer=root.querySelector('.editor-preview');layer.innerHTML='';if(hover!==null&&tool==='piece'){const absolute=candidate(hover);layer.innerHTML=pieceMarkup(absolute,color,fits(absolute)?'can-place':'cannot-place');}}
  function rotate(){if(!root?.querySelector('.editor-board')||tool!=='piece')return;const h=Math.max(...cells.map(c=>c[1]))+1;anchor=[h-1-anchor[1],anchor[0]];cells=C.rotate(cells);const b=root.querySelector(`[data-shape="${shape}"]`);b.querySelector('svg').outerHTML=callbacks.shapeSVG(cells,color);paintPreview();TerminalAudio.play('rotate');}
  function place(index){
    const x=index%draft.size,y=Math.floor(index/draft.size);
    if(tool==='erase'){draft.pieces=draft.pieces.filter(p=>!p.cells.some(c=>c[0]===x&&c[1]===y));draft.blocked=draft.blocked.filter(c=>c[0]!==x||c[1]!==y);draft.fixed=draft.fixed.filter(c=>c[0]!==x||c[1]!==y);}
    else if(tool==='fixed'){
      if(draft.blocked.some(c=>c[0]===x&&c[1]===y)||draft.pieces.some(p=>p.cells.some(c=>c[0]===x&&c[1]===y))){notice('此处已有阻挡块或元件，请先移除。',true);return;}
      const existing=draft.fixed.find(c=>c[0]===x&&c[1]===y);if(existing)existing[2]=color;else draft.fixed.push([x,y,color]);
    }
    else if(tool==='block'){
      if(draft.fixed.some(c=>c[0]===x&&c[1]===y)||draft.pieces.some(p=>p.cells.some(c=>c[0]===x&&c[1]===y))){notice('此处已有元件或固有块，请先移除。',true);return;}
      if(draft.blocked.some(c=>c[0]===x&&c[1]===y))draft.blocked=draft.blocked.filter(c=>c[0]!==x||c[1]!==y);else draft.blocked.push([x,y]);
    }else{
      const absolute=candidate(index);if(!fits(absolute)){notice('无法放置：请避开其他元件、阻挡块和棋盘边界。',true);TerminalAudio.play('invalid');return;}
      draft.pieces.push({color,cells:absolute});
    }
    renderLayout();notice('布局已更新。完成后点击“生成种子并保存”。');TerminalAudio.play('drop');
  }
  window.addEventListener('keydown',e=>{
    if(!root||e.target?.closest('input,textarea,select')||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.code==='KeyR'||e.key?.toLowerCase()==='r'){e.preventDefault();if(!e.repeat)rotate();}
    if(e.code==='Escape'){e.preventDefault();close();}
  });
  window.CustomRepairUI={open,showSeed(options,level){open(options);result(level);},escape:esc};
})();
