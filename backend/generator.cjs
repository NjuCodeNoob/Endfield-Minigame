'use strict';
const crypto=require('node:crypto');
const C=require('../dist/repair-core.js'),K=require('../dist/custom-core.js'),S=require('../dist/salvage-core.js'),SK=require('../dist/salvage-custom-core.js');
const rand=n=>crypto.randomInt(n),pick=a=>a[rand(a.length)],key=c=>c.join(','),shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function transform([x,y],n,type){return type===0?[n-1-x,n-1-y]:type===1?[n-1-x,y]:type===2?[x,n-1-y]:type===3?[y,x]:[n-1-y,n-1-x];}
function repair(mode){
 const simple=mode==='easy',n=(simple?3:4)+rand(5),type=rand(5),palette=shuffle(K.COLORS).slice(0,1+rand(simple?2:3)),busy=new Set(),pieces=[],fixed=[],blocked=[];
 const fits=c=>c.every(([x,y])=>x>=0&&y>=0&&x<n&&y<n&&!busy.has(key([x,y])))&&new Set(c.map(key)).size===c.length;
 const put=c=>c.forEach(p=>busy.add(key(p)));const allowed=new Set(K.SHAPES.map(K.canonicalShape));
 const target=2+rand(Math.max(2,n));
 for(let attempt=0;attempt<600&&pieces.length<target;attempt++){
  let shape=pick(K.SHAPES.slice(0,simple?9:K.SHAPES.length));for(let i=rand(4);i>0;i--)shape=C.rotate(shape);
  const x=rand(n),y=rand(n),cells=shape.map(([a,b])=>[x+a,y+b]);if(!fits(cells))continue;
  const color=pick(palette);
  if(simple){const mirror=cells.map(c=>transform(c,n,type));if(!allowed.has(K.canonicalShape(mirror))||!fits([...cells,...mirror]))continue;pieces.push({color,cells},{color,cells:mirror});put([...cells,...mirror]);}
  else{pieces.push({color,cells});put(cells);}
 }
 if(pieces.length<2)return repair(mode);
 for(let i=0;i<n;i++){
  const c=[rand(n),rand(n)],cells=simple?[...new Map([c,transform(c,n,type)].map(p=>[key(p),p])).values()]:[c];if(!fits(cells))continue;
  if(rand(2)){const color=pick(palette);fixed.push(...cells.map(p=>[...p,color]));}else blocked.push(...cells);put(cells);
 }
 const level=K.create({name:'Δ-竞速'+crypto.randomBytes(3).toString('hex'),size:n,blocked,fixed,pieces});
 return {level,seed:level.seed,answer:level.pieces.map((p,id)=>({id,color:p.color,cells:p.cells,x:0,y:0})),symmetry:simple?type:null};
}
// Sample arbitrary positions and lifts, then solve the two remaining force vectors.
// Socket symmetry is a separate constraint; the balloon solution need not be symmetric.
function balancedBalloons(count){
 if(count===1)return [{x:2,y:2,lift:pick(SK.LIFTS)}];
 const grid=Array.from({length:25},(_,i)=>[i%5,Math.floor(i/5)]);
 for(let attempt=0;attempt<256;attempt++){
  const cells=shuffle(grid),answer=cells.slice(0,count-2).map(([x,y])=>({x,y,lift:pick(SK.LIFTS)}));
  const hx=answer.reduce((v,b)=>v+b.lift*(b.x-2),0),vy=answer.reduce((v,b)=>v+b.lift*(b.y-2),0);
  const free=cells.slice(count-2),available=new Set(free.map(key)),closures=[];
  for(const [x,y] of free)for(const lift of SK.LIFTS)for(const secondLift of SK.LIFTS){
   const qx=2+(-hx-lift*(x-2))/secondLift,qy=2+(-vy-lift*(y-2))/secondLift;
   if((qx===x&&qy===y)||!available.has(key([qx,qy])))continue;
   const candidate=[...answer,{x,y,lift},{x:qx,y:qy,lift:secondLift}];
   // Prefer force-balanced asymmetric arrangements over equal opposite pairs.
   if(candidate.every(b=>candidate.some(c=>c.x===4-b.x&&c.y===4-b.y&&c.lift===b.lift)))continue;
   closures.push(candidate);
  }
  if(closures.length)return pick(closures);
 }
 // Bounded fallback keeps generation responsive, including very dense 25-balloon boards.
 const pairs=shuffle(grid.slice(0,12)),answer=[];
 for(let i=0;i<Math.floor(count/2);i++){const [x,y]=pairs[i],lift=pick(SK.LIFTS);answer.push({x,y,lift},{x:4-x,y:4-y,lift});}
 if(count%2)answer.push({x:2,y:2,lift:pick(SK.LIFTS)});
 return answer;
}
function salvage(mode){
 const easy=mode==='easy',count=1+rand(easy?12:25),answer=balancedBalloons(count),sockets=new Map(),type=rand(5);
 const put=p=>{sockets.set(key(p),p);if(easy){const q=transform(p,5,type);sockets.set(key(q),q);}};
 answer.forEach(b=>put([b.x,b.y]));for(let i=0;i<rand(12);i++)put([rand(5),rand(5)]);
 const level=SK.create({name:'Δ-竞速'+crypto.randomBytes(3).toString('hex'),sockets:[...sockets.values()],answer});
 const remaining=level.answer.slice();const state=level.balloons.map(b=>{const i=remaining.findIndex(x=>x.lift===b.lift),p=remaining.splice(i,1)[0];return {...b,x:p.x,y:p.y};});
 return {level,seed:level.seed,answer:state,symmetry:easy?type:null};
}
function generate(game,mode){if(!['repair','salvage'].includes(game)||!['easy','chaos'].includes(mode))throw Error('游戏或难度无效');return game==='repair'?repair(mode):salvage(mode);}
function publicLevel(p,id){const l=JSON.parse(JSON.stringify(p.level));delete l.seed;delete l.answer;l.id=id;l.code='Δ-竞速';l.name='竞速挑战';l.custom=true;if(l.pieces)l.pieces=l.pieces.map(p=>({color:p.color,cells:C.normalize(p.cells),turn:rand(4)}));return l;}
function verify(game,level,state){
 try{
 if(!Array.isArray(state))return false;
 if(game==='salvage')return S.evaluate(level,state).ready;
 if(state.length!==level.pieces.length||new Set(state.map(p=>p.id)).size!==state.length)return false;
 for(const p of state){const ref=level.pieces[p.id];if(!ref||!Number.isInteger(p.id)||p.color!==ref.color||!Array.isArray(p.cells)||p.cells.length!==ref.cells.length||!p.cells.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger))||K.canonicalShape(p.cells)!==K.canonicalShape(ref.cells))return false;}
 return C.solved(level,state);
 }catch{return false;}
}
module.exports={generate,publicLevel,verify,transform};
