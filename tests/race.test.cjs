const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../backend/generator.cjs'),{RaceService}=require('../backend/race-service.cjs');
const clone=o=>JSON.parse(JSON.stringify(o));
for(const game of ['repair','salvage'])for(const mode of ['easy','chaos'])test(`${game} ${mode}: 150 generated levels satisfy bounds, seed and witness`,()=>{
 const decode=game==='repair'?require('../dist/custom-core.js').decode:require('../dist/salvage-custom-core.js').decode;
 for(let i=0;i<150;i++){
  const p=G.generate(game,mode),l=p.level;assert(G.verify(game,l,p.answer));assert.deepEqual(decode(p.seed),l);
  const publicLevel=G.publicLevel(p,'test');assert(!publicLevel.seed&&!publicLevel.answer);assert(!publicLevel.id.includes(p.seed));
  if(game==='repair'){
   assert(l.size>=(mode==='easy'?3:4)&&l.size<=(mode==='easy'?7:8));assert(l.pieces.length>=2);assert(Object.keys(l.rows).length<=(mode==='easy'?2:3));
   if(mode==='easy'){const colors=new Map((l.fixed||[]).map(([x,y,c])=>[[x,y].join(','),c]));for(const b of p.answer)for(const [x,y] of b.cells)colors.set([b.x+x,b.y+y].join(','),b.color);for(const [coord,c] of colors)assert.equal(colors.get(G.transform(coord.split(',').map(Number),l.size,p.symmetry).join(',')),c);}
  }else{assert(l.balloons.length>=1&&l.balloons.length<=(mode==='easy'?12:25));if(mode==='easy'){const cells=new Set(l.sockets.map(c=>c.join(',')));for(const c of l.sockets)assert(cells.has(G.transform(c,5,p.symmetry).join(',')));}}
 }
});
function fixture(game='repair',count=5){let now=100000;const svc=new RaceService({now:()=>now});const aa=svc.session(),bb=svc.session(),a=svc.auth(aa.token),b=svc.auth(bb.token);svc.nickname(b,a.nickname);svc.create(a,{game,mode:'easy',count});const room=svc.current(a);svc.join(b,room.code);svc.start(a);return {svc,a,b,room,advance:n=>now+=n,load(){svc.loaded(a,room.round);svc.loaded(b,room.round);now+=3000;svc.sweep();},win(user){svc.submit(user,{round:room.round,state:clone(room.bank[room.round].answer)});}};}
test('same nickname allowed; room has exactly two participants and host controls',()=>{const f=fixture();assert.equal(f.a.nickname,f.b.nickname);const c=f.svc.auth(f.svc.session().token);assert.throws(()=>f.svc.join(c,f.room.code));assert.throws(()=>f.svc.start(f.b));assert.throws(()=>f.svc.configure(f.b,{count:9}));});
test('countdown rejects early answers and opponent receives identical public puzzle',()=>{const f=fixture();f.svc.loaded(f.a,0);assert.equal(f.room.status,'loading');f.svc.loaded(f.b,0);assert.throws(()=>f.win(f.a));assert.deepEqual(f.svc.view(f.room,f.a).level,f.svc.view(f.room,f.b).level);f.advance(3000);f.win(f.a);assert.equal(f.room.players[0].score,1);});
test('BO5 ends immediately on third victory; no double scoring or old-round replay',()=>{const f=fixture();f.load();const old=clone(f.room.bank[0].answer);f.win(f.a);f.svc.submit(f.b,{round:0,state:old});assert.equal(f.room.round,1);assert.equal(f.room.players[1].score,0);for(let i=0;i<2;i++){f.load();f.win(f.a);}assert.equal(f.room.status,'ended');assert.equal(f.room.result.winner,f.a.id);assert.equal(f.room.round,2);});
for(const count of [7,9])test(`BO${count} uses correct majority`,()=>{const f=fixture('salvage',count);for(let i=0;i<(count+1)/2;i++){f.load();f.win(f.a);}assert.equal(f.room.status,'ended');assert.equal(f.room.players[0].score,(count+1)/2);});
test('skip requires both consents, can be withdrawn, and all skipped is a draw',()=>{const f=fixture();for(let i=0;i<5;i++){f.load();f.svc.skip(f.a);f.svc.skip(f.a);assert.equal(f.room.players[0].skip,false);f.svc.skip(f.a);assert.equal(f.room.round,i);f.svc.skip(f.b);}assert.equal(f.room.status,'ended');assert.equal(f.room.result.winner,null);assert.deepEqual(f.room.players.map(p=>p.score),[0,0]);});
test('disconnect, host exit, loading timeout and round timeout settle safely',()=>{
 let f=fixture();f.load();f.advance(15000);f.svc.state(f.a);f.advance(6000);f.svc.sweep();assert.equal(f.room.result.winner,f.a.id);
 f=fixture();f.svc.leave(f.a);assert.equal(f.room.result.winner,f.b.id);
 f=fixture();f.svc.loaded(f.a,0);for(let i=0;i<4;i++){f.advance(8000);f.svc.state(f.a);f.svc.state(f.b);}assert.equal(f.room.result.reason,'加载超时');
 f=fixture();f.load();for(let i=0;i<31;i++){f.advance(10000);f.svc.state(f.a);f.svc.state(f.b);}assert.equal(f.room.round,1);assert.equal(f.room.log[0].winner,null);
});
test('server rejects forged shapes, colors, missing pieces, balloon lift and local time',()=>{for(const game of ['repair','salvage']){const f=fixture(game);f.load();const good=clone(f.room.bank[0].answer),bad=clone(good);if(game==='repair')bad[0].color='hacked';else bad[0].lift=999;assert.throws(()=>f.svc.submit(f.a,{round:0,state:bad,elapsed:1}));assert(!G.verify(game,f.room.bank[0].level,good.slice(1)));if(game==='repair'){bad[0]=clone(good[0]);bad[0].cells=[[0,0]];assert(!G.verify(game,f.room.bank[0].level,bad));}f.win(f.a);assert.equal(f.room.players[0].score,1);}});
test('solo: five valid answers, measured server time, rankings and seeds',()=>{let now=100000;const svc=new RaceService({now:()=>now}),auth=svc.session(),u=svc.auth(auth.token);svc.create(u,{game:'repair',mode:'easy'},true);const r=svc.current(u);for(let i=0;i<5;i++){svc.loaded(u,i);now+=i===0?4000:1000;svc.submit(u,{round:i,state:r.bank[i].answer,elapsed:-1});}assert.equal(r.record.elapsed,5000);assert.equal(svc.results(u,'repair','easy')[0].seeds.length,5);assert.equal(svc.results(u,'repair','easy')[0].rank,1);assert.equal(svc.results(u,'repair','chaos').length,0);assert.equal(svc.view(r,u).best,5000);});
test('secret tokens are not room ids, nickname escapes are rejected, seeds hidden until end',()=>{const f=fixture();assert.throws(()=>f.svc.auth(f.room.id));assert.throws(()=>f.svc.nickname(f.a,'<script>'));const view=f.svc.view(f.room,f.b);assert.equal(view.review,null);assert(!JSON.stringify(view).includes(f.room.bank[0].seed));});
test('host can kick only while waiting and full room code invalid after host leaves',()=>{const svc=new RaceService(),a=svc.auth(svc.session().token),b=svc.auth(svc.session().token);const v=svc.create(a,{game:'repair',mode:'easy',count:5});svc.join(b,v.code);svc.kick(a);assert.equal(svc.state(b).active,false);svc.join(b,v.code);svc.leave(a);const c=svc.auth(svc.session().token);assert.throws(()=>svc.join(c,v.code));});
test('persistent personal identity and leaderboard survive restart, active rooms do not',()=>{const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'endfield-race-'));try{const file=path.join(dir,'store.json');let svc=new RaceService({file}),auth=svc.session();svc.nickname(svc.auth(auth.token),'测试管理员');svc.records.push({user:auth.user,game:'repair',mode:'easy',elapsed:50,seeds:[]});svc.persist();svc=new RaceService({file});assert.equal(svc.auth(auth.token).nickname,'测试管理员');assert.equal(svc.records.length,1);assert.equal(svc.auth(auth.token).active,null);}finally{fs.rmSync(dir,{recursive:true});}});

test('finished 3:0 result survives either player leaving and disables rematch',()=>{for(const leaving of ['a','b']){const f=fixture();for(let i=0;i<3;i++){f.load();f.win(f.a);}const before=clone(f.room.result);f.svc.leave(f[leaving]);const other=f[leaving==='a'?'b':'a'];const v=f.svc.state(other);assert.deepEqual(v.result,before);assert.deepEqual(v.players.map(p=>p.score),[3,0]);assert.equal(v.canRematch,false);assert.equal(v.players.length,2);assert.throws(()=>f.svc.start(other));}});

test('salvage generates asymmetric balloon forces while easy sockets retain symmetry',()=>{
 for(const mode of ['easy','chaos']){let asymmetric=0,unequal=0,oddOffCenter=0;
  for(let i=0;i<200;i++){const p=G.generate('salvage',mode),a=p.answer;assert(G.verify('salvage',p.level,a));
   const symmetric=a.every(b=>a.some(c=>c.x===4-b.x&&c.y===4-b.y&&c.lift===b.lift));if(!symmetric)asymmetric++;
   if(a.some(b=>a.some(c=>c.x===4-b.x&&c.y===4-b.y&&c.lift!==b.lift)))unequal++;
   if(a.length%2===1&&!a.some(b=>b.x===2&&b.y===2))oddOffCenter++;
  }
  assert(asymmetric>120,mode+' should usually have asymmetric solutions');assert(unequal>0);assert(oddOffCenter>0);
 }
});
