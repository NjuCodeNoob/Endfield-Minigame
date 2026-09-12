const test=require('node:test'),assert=require('node:assert/strict');
const K=require('../dist/custom-core'),C=require('../dist/repair-core'),builtins=require('../dist/repair-levels');
const sample=()=>({name:'Δ-测试关卡',size:3,blocked:[[2,2]],pieces:[{color:'lime',cells:[[0,0],[1,0]]},{color:'blue',cells:[[0,1],[0,2]]},{color:'amber',cells:[[1,1],[1,2]]}]});
test('version 1 golden seed is deterministic, lossless, independent of order and portable between runtimes',()=>{
  const seed=K.encode(sample());
  assert.equal(seed,'EFT1.WyLOlC3mtYvor5XlhbPljaEiLDMsWzhdLFtbMCxbMCwxXV0sWzEsWzMsNl1dLFsyLFs0LDddXV1d.351b9544');
  const reordered=sample();reordered.pieces.reverse();reordered.pieces.forEach(p=>p.cells.reverse());
  assert.equal(K.encode(reordered),seed);assert.equal(K.encode(K.decode(seed)),seed);
  const level=K.decode(seed);assert.deepEqual(K.create(sample()),level);
  for(const change of [d=>d.name='Δ-另一题',d=>d.size=4,d=>d.blocked=[],d=>d.pieces[0].color='amber']){const d=sample();change(d);assert.notEqual(K.encode(d),seed);}
});
test('every previously used shape is present for all three custom colors without losing chirality',()=>{
  const registry=new Set(K.SHAPES.map(K.canonicalShape));
  assert.equal(registry.size,21);
  for(const level of builtins)for(const p of level.pieces)assert.ok(registry.has(K.canonicalShape(p.cells)));
  for(const color of K.COLORS)for(const cells of K.SHAPES){const l=K.create({name:'Δ-形状',size:5,blocked:[],pieces:[{color,cells}]});assert.equal(l.pieces[0].color,color);}
});
test('maximum 15x15 three-color level round-trips and its witness solves every count',()=>{
  const d={name:'Δ-十五格三色',size:15,blocked:[],pieces:[]};
  for(let y=0;y<15;y++)for(let x=0;x<14;x+=2)d.pieces.push({color:K.COLORS[(x+y)%3],cells:[[x,y],[x+1,y]]});
  for(let y=0;y<15;y++)d.blocked.push([14,y]);
  const l=K.create(d),state=l.pieces.map((p,id)=>({...p,id,x:0,y:0}));
  assert.equal(l.pieces.length,105);assert.ok(C.solved(l,state));assert.equal(K.encode(l),l.seed);
});
test('rejects corrupt seeds, oversized boards, bad names, absent pieces, overlap, unsupported shapes and unknown colors',()=>{
  const seed=K.encode(sample());assert.throws(()=>K.decode(seed.slice(0,-1)+'0'));assert.throws(()=>K.decode('EFT2.'+seed.slice(5)));assert.throws(()=>K.decode('x'.repeat(20001)));
  for(const change of [d=>d.size=2,d=>d.size=16,d=>d.size=3.5,d=>d.name='没有前缀',d=>d.name='Δ-'+ '长'.repeat(14),d=>d.name='Δ-<img>',d=>d.pieces=[],d=>d.pieces[0].cells=[[0,0],[4,0]],d=>d.blocked.push([0,0]),d=>d.pieces[0].cells=[[0,0],[0,0]],d=>d.pieces[0].color='red',d=>d.pieces[0].cells=[[0,0],[2,0]]]){const d=sample();change(d);assert.throws(()=>K.create(d));}
});
test('local saves deduplicate, reload and delete only the selected custom level; quota failures are explicit',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},a=K.create(sample()),d=sample();d.name='Δ-第二题';const b=K.create(d);
  K.save(storage,a);K.save(storage,a);K.save(storage,b);assert.equal(K.read(storage).length,2);
  K.remove(storage,a.id);assert.deepEqual(K.read(storage).map(l=>l.id),[b.id]);
  assert.throws(()=>K.save({getItem:()=>null,setItem:()=>{throw Error('quota');}},a),/保存失败/);
  assert.deepEqual(K.read({getItem:()=>{throw Error('disabled');}}),[]);
});

test('ten supplied silhouettes are distinct, retain their cells through rotation and round-trip as EFT2',()=>{
  const diagrams=['#../###/.#./.#.','##./###/.##','..#/#.#/###','.##/##./#..','#./##/#./##','####/..#.','..#/..#/###','.##/##.','#.#/###','###/#.#/##.'];
  diagrams.forEach((diagram,i)=>{
    const cells=diagram.split('/').flatMap((row,y)=>[...row].flatMap((v,x)=>v==='#'?[[x,y]]:[]));
    assert.deepEqual(K.ADDED_SHAPES[i],cells);
    for(const color of K.COLORS){const l=K.create({name:'Δ-新增形状',size:5,blocked:[],pieces:[{color,cells}]});assert.ok(l.seed.startsWith('EFT2.'));assert.equal(K.encode(l),l.seed);assert.equal(K.canonicalShape(C.initial(l)[0].cells),K.canonicalShape(cells));}
  });
});

test('fixed colors participate in counts and collisions, survive seeds, and reject invalid placement',()=>{
  const draft={name:'Δ-固有回路',size:3,blocked:[[2,2]],fixed:[[1,0,'blue'],[2,0,'amber']],pieces:[{color:'lime',cells:[[0,0],[0,1]]}]};
  const l=K.create(draft);assert.match(l.seed,/^EFT2\./);assert.equal(K.encode(l),l.seed);assert.deepEqual(l.fixed,draft.fixed);
  assert.deepEqual(C.counts(l,C.initial(l)).rows.blue,[1,0,0]);assert.deepEqual(l.rows.amber,[1,0,0]);
  const ps=C.initial(l);assert.equal(C.canPlace(l,ps,ps[0],1,0),false);
  assert.equal(C.solved(l,[{...ps[0],cells:[[0,0],[0,1]],x:0,y:0}]),true);
  for(const fixed of [[[0,0,'lime']],[[2,2,'blue']],[[3,0,'blue']],[[1,0,'red']],[[1,0,'blue'],[1,0,'amber']]])assert.throws(()=>K.create({...draft,fixed}));
  const reverse={...draft,fixed:[...draft.fixed].reverse()};assert.equal(K.encode(reverse),l.seed);
});
