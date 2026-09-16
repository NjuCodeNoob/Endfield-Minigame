// Explicit integration check against a running LOCAL wrangler dev instance only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const base='http://127.0.0.1:8787';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){for(let i=0;i<120;i++){if(fn())return;await pause(50);}throw Error('Timed out waiting for push');}
async function api(op,data,token){const r=await fetch(base+'/api/'+op,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data)});const v=await r.json();assert.equal(r.status,200,op+': '+JSON.stringify(v));return v;}
function storedRace(user){const files=fs.readdirSync('cloudflare/.wrangler/state/v3/do',{recursive:true}).filter(f=>f.endsWith('.sqlite')&&!f.includes('metadata'));for(const f of files){const db=new DatabaseSync(path.join('cloudflare/.wrangler/state/v3/do',f),{readOnly:true});try{for(const row of db.prepare("SELECT value FROM state WHERE key LIKE 'r:%'").all()){const r=JSON.parse(row.value);if(r.players.some(p=>p.id===user)&&r.status!=='ended')return r;}}catch{}finally{db.close();}}throw Error('Local fixture missing');}
async function socket(auth){const ws=new WebSocket(base.replace('http:','ws:')+'/api/stream',['endfield-race','auth.'+auth.token]);const client={ws,events:[]};ws.onmessage=e=>client.events.push(JSON.parse(e.data).state);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});client.timer=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'ping'}));},4000);client.close=()=>{clearInterval(client.timer);ws.close();};return client;}
(async()=>{
 const a=await api('session',{}),b=await api('session',{});assert(a.websocket);const room=await api('create',{game:'salvage',mode:'easy',count:5},a.token);const sa=await socket(a);await api('join',{code:room.code},b.token);const sb=await socket(b);
 try{await wait(()=>sa.events.some(s=>s.players?.length===2));await api('start',{},a.token);
 for(let i=0;i<3;i++){await api('loaded',{round:i},a.token);const ready=await api('loaded',{round:i},b.token);await pause(Math.max(0,ready.readyAt-Date.now()+50));const r=storedRace(a.user);const solved=await api('submit',{round:i,state:r.bank[i].answer},a.token);assert.equal(solved.players[0].score,i+1);await wait(()=>sb.events.some(s=>s.players?.[0].score===i+1));}
 assert.equal(sa.events.at(-1).result.winner,a.user);await api('leave',{},a.token);await wait(()=>sb.events.some(s=>s.canRematch===false));assert.equal(sb.events.at(-1).result.winner,a.user);await api('leave',{},b.token);
 }finally{sa.close();sb.close();}
 const c=await api('session',{});await api('solo',{game:'repair',mode:'chaos'},c.token);
 for(let i=0;i<5;i++){const ready=await api('loaded',{round:i},c.token);await pause(Math.max(0,ready.readyAt-Date.now()+20));const r=storedRace(c.user);const result=await api('submit',{round:i,state:r.bank[i].answer},c.token);if(i===4){assert(result.rank>=1);assert(result.best>0);assert.equal(result.review.length,5);}}
 const history=await api('history?game=repair&mode=chaos',undefined,c.token);assert.equal(history.length,1);assert.equal(history[0].seeds.length,5);await api('leave',{},c.token);
 const invalid=await fetch(base+'/api/state');assert.equal(invalid.status,401);const blocked=await fetch(base+'/api/state',{headers:{Origin:'https://invalid.example'}});assert.equal(blocked.status,403);
 fs.writeFileSync('.tools/cloudflare-persistence-test.json',JSON.stringify({token:c.token,user:c.user,record:history[0].id}));
 console.log('PASS Cloudflare: real WebSocket push, BO5 3:0, immutable result after exit, solo five rounds, D1 ranking/history, auth and CORS.');
})().catch(e=>{console.error(e);process.exitCode=1;});
