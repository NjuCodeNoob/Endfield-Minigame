(function(root){
  const C=typeof module!=='undefined'&&module.exports?require('./repair-core.js'):root.RepairCore;
  const COLORS=['lime','blue','amber'];
  // Version 1 is frozen: adding built-in levels must never alter an existing seed.
  const V1_SHAPES=[[[0,0],[0,1]],[[0,0],[0,1],[0,2]],[[0,0],[0,1],[1,1]],[[0,0],[0,1],[0,2],[1,2]],[[0,0],[0,1],[1,1],[0,2]],[[0,0],[0,1],[1,1],[2,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[1,1],[2,1]],[[1,0],[0,1],[1,1],[2,1],[1,2]],[[0,0],[0,1],[1,1],[2,1],[1,2],[2,2]],[[0,0],[1,0],[0,1],[0,2],[3,2],[0,3],[1,3],[2,3],[3,3]]];
  const ADDED_SHAPES=[
    [[0,0],[0,1],[1,1],[2,1],[1,2],[1,3]],
    [[0,0],[1,0],[0,1],[1,1],[2,1],[1,2],[2,2]],
    [[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]],
    [[1,0],[2,0],[0,1],[1,1],[0,2]],
    [[0,0],[0,1],[1,1],[0,2],[0,3],[1,3]],
    [[0,0],[1,0],[2,0],[3,0],[2,1]],
    [[2,0],[2,1],[0,2],[1,2],[2,2]],
    [[1,0],[2,0],[0,1],[1,1]],
    [[0,0],[2,0],[0,1],[1,1],[2,1]],
    [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2]]
  ];
  const SHAPES=[...V1_SHAPES,...ADDED_SHAPES];
  const sorted=cells=>cells.slice().sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  function canonicalShape(cells){let c=C.normalize(cells),variants=[];for(let i=0;i<4;i++){variants.push(JSON.stringify(sorted(c)));c=C.rotate(c);}return variants.sort()[0];}
  const allowedV1=new Set(V1_SHAPES.map(canonicalShape)),allowed=new Set(SHAPES.map(canonicalShape));
  const fail=message=>{throw new Error(message);};
  function canonical(draft,version=2){
    const rawName=draft?.custom?draft.code:draft?.name;
    if(typeof rawName!=='string')fail('请输入关卡名称。');
    const name=rawName.normalize('NFC').trim();
    if(!name.startsWith('Δ-')||name.length===2||Array.from(name).length>15||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>]/u.test(name))fail('名称须以 Δ- 开头，总长 3–15 字，不可含控制字符或尖括号。');
    const n=draft.size;if(!Number.isInteger(n)||n<3||n>15)fail('棋盘边长须为 3–15 的整数。');
    if(!Array.isArray(draft.blocked)||draft.blocked.length>n*n||!Array.isArray(draft.pieces)||draft.pieces.length<1||draft.pieces.length>112)fail('请至少放置一个元件，并将所有元件放入棋盘。');
    const busy=new Set();
    const cell=c=>{if(!Array.isArray(c)||c.length!==2||!c.every(Number.isInteger)||c.some(v=>v<0||v>=n))fail('存在超出棋盘的格子。');const index=c[1]*n+c[0];if(busy.has(index))fail('元件或阻挡块相互重叠。');busy.add(index);return index;};
    const blocked=draft.blocked.map(cell).sort((a,b)=>a-b);
    const rawFixed=draft.fixed||[];
    if(!Array.isArray(rawFixed)||rawFixed.length>n*n||(version===1&&rawFixed.length))fail('固有块数据无效。');
    const fixed=rawFixed.map(c=>{if(!Array.isArray(c)||c.length!==3||!COLORS.includes(c[2]))fail('固有块颜色或坐标无效。');return [cell(c.slice(0,2)),COLORS.indexOf(c[2])];}).sort((a,b)=>a[0]-b[0]);
    const pieces=draft.pieces.map(p=>{
      if(!p||!COLORS.includes(p.color)||!Array.isArray(p.cells)||p.cells.length<2||p.cells.length>9)fail('元件颜色或形状无效。');
      const cells=p.cells.map(cell).sort((a,b)=>a-b);
      if(!(version===1?allowedV1:allowed).has(canonicalShape(p.cells)))fail('种子包含未支持的元件形状。');
      return [COLORS.indexOf(p.color),cells];
    }).sort((a,b)=>a[0]-b[0]||compareCells(a[1],b[1]));
    return version===1?[name,n,blocked,pieces]:[name,n,blocked,pieces,fixed];
  }
  function compareCells(a,b){for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]-b[i];return a.length-b.length;}
  function checksum(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return ((crc^0xffffffff)>>>0).toString(16).padStart(8,'0');}
  function pack(data,version=1){const bytes=new TextEncoder().encode(JSON.stringify(data));const base=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return `EFT${version}.${base}.${checksum(bytes)}`;}
  function encode(draft){
    const data=canonical(draft,2);
    const legacy=!data[4].length&&draft.pieces.every(p=>allowedV1.has(canonicalShape(p.cells)));
    return pack(legacy?data.slice(0,4):data,legacy?1:2);
  }
  function unpack(data,version){
    if(!Array.isArray(data)||data.length!==(version===1?4:5)||!Array.isArray(data[2])||!Array.isArray(data[3]))fail('种子结构无效。');
    const [name,size,blocked,pieces]=data;
    if(version===2&&!Array.isArray(data[4]))fail('固有块数据无效。');
    const cell=index=>{if(!Number.isInteger(index)||index<0||index>=size*size)fail('种子格子坐标无效。');return [index%size,Math.floor(index/size)];};
    return {name,size,blocked:blocked.map(cell),...(version===2?{fixed:data[4].map(f=>{if(!Array.isArray(f)||f.length!==2||!Number.isInteger(f[1]))fail('固有块数据无效。');return [...cell(f[0]),COLORS[f[1]]];})}:{}),pieces:pieces.map(p=>{if(!Array.isArray(p)||p.length!==2||!Number.isInteger(p[0])||!Array.isArray(p[1]))fail('种子元件数据无效。');return {color:COLORS[p[0]],cells:p[1].map(cell)};})};
  }
  function toLevel(draft,seed){
    const colors=COLORS.filter(color=>(draft.pieces.some(p=>p.color===color)||(draft.fixed||[]).some(c=>c[2]===color)));
    const level={id:'custom:'+seed,custom:true,seed,code:draft.name,name:draft.name.slice(2),size:draft.size,blocked:draft.blocked,...(draft.fixed?{fixed:draft.fixed}:{}),rows:Object.fromEntries(colors.map(c=>[c,Array(draft.size).fill(0)])),cols:{},pieces:draft.pieces.map(p=>{
      let cells=C.normalize(p.cells),turn=0;const key=canonicalShape(cells);while(JSON.stringify(sorted(cells))!==key&&turn<4){cells=C.rotate(cells);turn++;}return {...p,turn};
    })};
    const state=draft.pieces.map((p,id)=>({id,color:p.color,cells:p.cells,x:0,y:0}));
    const counts=C.counts(level,state);level.rows=counts.rows;level.cols=counts.cols;
    if(!C.solved(level,state))fail('关卡校验失败：参考布局必须可解。');
    return level;
  }
  function decode(input){
    if(typeof input!=='string'||input.length>20000)fail('种子过长或格式无效。');
    const seed=input.trim(),match=/^EFT([12])\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(seed);
    if(!match)fail('种子格式不正确，请完整复制 EFT1 或 EFT2 开头的种子。');
    let data;try{const bytes=Uint8Array.from(atob(match[2].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(checksum(bytes)!==match[3])fail('种子校验失败，内容可能不完整。');data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch(e){fail(e.message.startsWith('种子')?e.message:'种子内容无法解析。');}
    const version=Number(match[1]),draft=unpack(data,version),normalized=canonical(draft,version);
    if(pack(normalized,version)!==seed||encode(draft)!==seed)fail('种子不是标准格式，请使用创建关卡生成的种子。');
    return toLevel(unpack(normalized,version),seed);
  }
  function create(draft){return decode(encode(draft));}
  const KEY='endfield.repair.custom.v1';
  function read(storage){let saved;try{saved=JSON.parse(storage.getItem(KEY)||'[]');}catch{return [];}if(!Array.isArray(saved))return [];const result=new Map();for(const seed of saved){try{const l=decode(seed);result.set(l.id,l);}catch{}}return [...result.values()];}
  function save(storage,level){const list=read(storage),found=list.some(l=>l.id===level.id);if(!found)list.push(decode(level.seed));try{storage.setItem(KEY,JSON.stringify(list.map(l=>l.seed)));}catch{fail('保存失败：浏览器存储不可用或空间不足。请先复制种子。');}return list;}
  function remove(storage,id){const list=read(storage).filter(l=>l.id!==id);try{storage.setItem(KEY,JSON.stringify(list.map(l=>l.seed)));}catch{fail('删除失败：浏览器存储不可用。');}return list;}
  const api={COLORS,SHAPES,ADDED_SHAPES,canonicalShape,encode,decode,create,read,save,remove};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CustomRepair=api;
})(globalThis);
