const assert=require('node:assert/strict');
(async()=>{
const base='http://127.0.0.1:5173/api/';
async function call(p,data,token){const r=await fetch(base+p,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data)});assert.equal(r.status,200,p);return r.json();}
assert((await call('health')).ok);
const a=await call('session',{}),b=await call('session',{});
const room=await call('create',{game:'salvage',mode:'easy',count:5},a.token);
await call('join',{code:room.code},b.token);
const started=await call('start',{},a.token);assert.equal(started.players.length,2);
await call('loaded',{round:0},a.token);
const ready=await call('loaded',{round:0},b.token);assert.equal(ready.status,'countdown');
const peer=await call('state',undefined,a.token);assert.deepEqual(peer.level,ready.level);assert.equal(peer.level.seed,undefined);
await call('leave',{},b.token);
const ended=await call('state',undefined,a.token);assert.equal(ended.result.winner,a.user);
await call('leave',{},a.token);
assert.equal((await call('leaderboard?game=salvage&mode=easy',undefined,a.token)).length,0);
console.log('PASS: health, identities, create/join, identical puzzle, countdown, forfeit, persistent storage API.');
})().catch(e=>{console.error(e);process.exitCode=1;});
