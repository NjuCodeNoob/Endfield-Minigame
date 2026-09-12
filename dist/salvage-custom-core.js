(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CustomSalvage=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const KEY='endfield.salvage.custom.v1',LIFTS=[1,2,3,6];
  const fail=message=>{throw new Error(message);};
  function canonical(draft){
    const name=String(draft?.name||'').normalize('NFC').trim();
    if(!name.startsWith('Δ-')||Array.from(name).length<3||Array.from(name).length>15||/[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name))fail('名称以 Δ- 开头，总长 3–15 字，不可含控制字符或尖括号。');
    if(!Array.isArray(draft.sockets)||draft.sockets.length<1||draft.sockets.length>25)fail('请设置至少一个绑缚位置。');
    const index=p=>{if(!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isInteger(v)&&v>=0&&v<5))fail('绑缚位置超出 5×5 棋盘。');return p[1]*5+p[0];};
    const sockets=draft.sockets.map(index).sort((a,b)=>a-b);
    if(new Set(sockets).size!==sockets.length)fail('绑缚位置重复。');
    if(!Array.isArray(draft.answer)||!draft.answer.length||draft.answer.length>sockets.length)fail('请摆放至少一个气球，作为可解布局。');
    const answer=draft.answer.map(b=>{const cell=index([b.x,b.y]);if(!sockets.includes(cell)||!LIFTS.includes(b.lift))fail('气球升力或绑缚位置无效。');return [cell,b.lift];}).sort((a,b)=>a[0]-b[0]);
    if(new Set(answer.map(b=>b[0])).size!==answer.length)fail('同一位置只能放置一个气球。');
    if(answer.reduce((s,[i,v])=>s+(i%5-2)*v,0)!==0||answer.reduce((s,[i,v])=>s+(Math.floor(i/5)-2)*v,0)!==0)fail('布局尚未平衡：请让左右、上下偏移量均为 0。');
    return [name,sockets,answer];
  }
  function checksum(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');}
  // A frozen canonical JSON format encoded as UTF-8 hexadecimal: portable without platform APIs.
  function seedFor(data){const json=JSON.stringify(data),bytes=encodeURIComponent(json).replace(/%([0-9A-F]{2})|([^%])/g,(_,hex,char)=>hex?hex.toLowerCase():char.charCodeAt(0).toString(16).padStart(2,'0'));return `EFS1.${bytes}.${checksum(json)}`;}
  function level(data,seed){const [name,sockets,answer]=data,balloons=answer.map(([,lift],id)=>({id,lift})).sort((a,b)=>b.lift-a.lift).map((b,id)=>({...b,id}));return {id:'custom-salvage:'+seed,custom:true,code:name,name:name.slice(2),size:5,stage:1,total:1,sockets:sockets.map(i=>[i%5,Math.floor(i/5)]),balloons,lift:balloons.reduce((s,b)=>s+b.lift,0),seed,answer:answer.map(([i,lift])=>({x:i%5,y:Math.floor(i/5),lift}))};}
  function create(draft){const data=canonical(draft);return level(data,seedFor(data));}
  function decode(seed){
    seed=String(seed||'').trim();if(seed.length>10000||!/^EFS1\.(?:[a-f0-9]{2})+\.[a-f0-9]{8}$/.test(seed))fail('种子格式无效，请粘贴完整的 EFS1. 种子。');
    try{const [,hex,hash]=seed.split('.'),json=decodeURIComponent(hex.replace(/../g,v=>'%'+v));if(checksum(json)!==hash)fail('种子校验失败，请检查复制是否完整。');const data=JSON.parse(json);if(!Array.isArray(data)||data.length!==3)fail('种子内容无效。');const [name,sockets,answer]=data;const validated=canonical({name,sockets:sockets.map(i=>[i%5,Math.floor(i/5)]),answer:answer.map(([i,lift])=>({x:i%5,y:Math.floor(i/5),lift}))});if(seedFor(validated)!==seed)fail('种子不是规范格式。');return level(validated,seed);}catch(error){throw new Error(error.message.startsWith('种子')||error.message.includes('布局')?error.message:'种子内容无效或损坏。');}
  }
  function read(storage){try{const raw=JSON.parse(storage.getItem(KEY)||'[]');if(!Array.isArray(raw))return [];return [...new Set(raw)].flatMap(seed=>{try{return [decode(seed)];}catch{return [];}});}catch{return [];}}
  function save(storage,l){const validated=decode(l.seed),all=read(storage);if(!all.some(x=>x.id===validated.id))all.push(validated);storage.setItem(KEY,JSON.stringify(all.map(x=>x.seed)));return validated;}
  function remove(storage,id){storage.setItem(KEY,JSON.stringify(read(storage).filter(l=>l.id!==id).map(l=>l.seed)));}
  return {KEY,LIFTS,create,decode,read,save,remove};
});
