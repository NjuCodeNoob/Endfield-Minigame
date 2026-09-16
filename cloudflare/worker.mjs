import { DurableObject } from 'cloudflare:workers';
import { createHash } from 'node:crypto';
import engine from '../backend/race-service.cjs';
const { RaceService }=engine;
const hash=s=>createHash('sha256').update(s).digest('hex');
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const allowed=new Set((env.ALLOWED_ORIGINS||'').split(','));allowed.add(url.origin);
  if(origin&&!allowed.has(origin))return json({error:'此站点未获服务器允许。'},403);
  const headers={'Access-Control-Allow-Origin':origin||url.origin,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!url.pathname.startsWith('/api/'))return json({error:'竞速 API 服务'},404);
  if(url.pathname==='/api/health')return json({ok:true,version:2,transport:'websocket'});
  if(Number(request.headers.get('Content-Length'))>65536)return json({error:'请求过大'},413);
  let payload;if(request.method==='POST'){payload=await request.arrayBuffer();if(payload.byteLength>65536)return json({error:'请求过大'},413);}const forwarded=new Request(request,payload?{body:payload}:{});forwarded.headers.set('X-Race-IP',request.headers.get('CF-Connecting-IP')||'local');
  // A single authoritative coordinator is intentionally used for the initial small-scale release.
  const result=await env.RACE_HUB.get(env.RACE_HUB.idFromName('race-v1')).fetch(forwarded);
  if(result.status===101)return result;
  const response=new Response(result.body,result);for(const [k,v] of Object.entries(headers))response.headers.set(k,v);return response;
 }
};
export class RaceHub extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.svc=new RaceService();this.queue=Promise.resolve();this.saved=new Map();this.accounts=new Map();this.limits=new Map();
  ctx.blockConcurrencyWhile(async()=>{
   ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
   for(const row of ctx.storage.sql.exec('SELECT key,value FROM state')){
    const value=JSON.parse(row.value);this.saved.set(row.key,row.value);
    if(row.key.startsWith('u:')){this.svc.users.set(value.key,value);this.accounts.set(value.key,JSON.stringify({key:value.key,id:value.id,nickname:value.nickname}));}
    if(row.key.startsWith('r:')){this.svc.races.set(value.id,value);if(value.code&&!value.closed)this.svc.rooms.set(value.code,value.id);}
    if(row.key.startsWith('o:'))this.svc.records.push(value);
   }
  });
 }
 serial(fn){const task=this.queue.then(fn,fn);this.queue=task.catch(()=>{});return task;}
 async account(token){if(!token)return;const key=hash(token);if(!this.svc.users.has(key)){const u=await this.env.DB.prepare('SELECT key,id,nickname FROM users WHERE key=?').bind(key).first();if(u){this.svc.users.set(key,{...u,active:null});this.accounts.set(key,JSON.stringify(u));}}}
 limit(key,max){const now=Date.now(),v=this.limits.get(key);if(!v||now-v.at>60000)this.limits.set(key,{at:now,n:1});else if(++v.n>max)throw error('请求过于频繁，请稍后再试。',429);if(this.limits.size>5000)for(const [k,x] of this.limits)if(now-x.at>60000)this.limits.delete(k);}
 snapshot(){
  const entries=new Map();for(const u of this.svc.users.values())if(u.active)entries.set('u:'+u.key,JSON.stringify(u));
  for(const r of this.svc.races.values())entries.set('r:'+r.id,JSON.stringify(r));for(const r of this.svc.records)entries.set('o:'+r.id,JSON.stringify(r));
  this.ctx.storage.transactionSync(()=>{for(const k of this.saved.keys())if(!entries.has(k))this.ctx.storage.sql.exec('DELETE FROM state WHERE key=?',k);for(const [k,v] of entries)if(v!==this.saved.get(k))this.ctx.storage.sql.exec('INSERT OR REPLACE INTO state(key,value) VALUES(?,?)',k,v);});this.saved=entries;
 }
 async persist(){
  for(const u of this.svc.users.values())if(u.active&&!this.svc.races.has(u.active))u.active=null;
  for(const u of this.svc.users.values()){const value=JSON.stringify({key:u.key,id:u.id,nickname:u.nickname});if(value!==this.accounts.get(u.key)){await this.env.DB.prepare('INSERT INTO users(key,id,nickname) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET nickname=excluded.nickname').bind(u.key,u.id,u.nickname).run();this.accounts.set(u.key,value);}}
  // Write an outbox before D1: retrying after eviction cannot lose or duplicate a completed score.
  this.snapshot();
  for(const r of this.svc.records)await this.env.DB.prepare('INSERT OR IGNORE INTO records(id,user,nickname,game,mode,elapsed,at,seeds) VALUES(?,?,?,?,?,?,?,?)').bind(r.id,r.user,r.nickname,r.game,r.mode,r.elapsed,r.at,JSON.stringify(r.seeds)).run();
  if(this.svc.records.length){this.svc.records=[];this.snapshot();}
  await this.schedule();
  for(const [key,u] of this.svc.users)if(!u.active){this.svc.users.delete(key);this.accounts.delete(key);}
 }
 async schedule(){const now=Date.now(),deadlines=[];for(const r of this.svc.races.values()){
  if(r.status==='ended'){deadlines.push(r.updatedAt+3600001);continue;}
  if(r.status==='lobby'){deadlines.push(r.createdAt+1800001);continue;}
  deadlines.push(...r.players.map(p=>p.seen+20001));if(r.status==='loading')deadlines.push(r.roundAt+30001);if(r.readyAt){deadlines.push(r.readyAt+300001);if(r.status==='countdown')deadlines.push(r.readyAt);}
 }if(deadlines.length)await this.ctx.storage.setAlarm(Math.max(now+100,Math.min(...deadlines)));else await this.ctx.storage.deleteAlarm();}
 async decorate(view,u){if(!view?.active)return view;if(view.solo&&view.elapsed){const r=this.svc.current(u).record;const rank=await this.env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE game=? AND mode=? AND (elapsed<? OR (elapsed=? AND at<?) OR (elapsed=? AND at=? AND id<?))').bind(r.game,r.mode,r.elapsed,r.elapsed,r.at,r.elapsed,r.at,r.id).first();const best=await this.env.DB.prepare('SELECT MIN(elapsed) AS best, SUM(CASE WHEN id<>? AND elapsed<=? THEN 1 ELSE 0 END) AS prior FROM records WHERE user=? AND game=? AND mode=?').bind(r.id,r.elapsed,u.id,r.game,r.mode).first();view.rank=rank.n+1;view.best=best.best;view.newBest=!best.prior;}return view;}
 async listing(u,url){const history=url.pathname.endsWith('/history'),game=url.searchParams.get('game'),mode=url.searchParams.get('mode');if(!['repair','salvage'].includes(game)||!['easy','chaos'].includes(mode))throw error('游戏或难度无效');const q=history?'SELECT * FROM records WHERE game=? AND mode=? AND user=? ORDER BY at DESC,id LIMIT 100':'SELECT * FROM records WHERE game=? AND mode=? ORDER BY elapsed,at,id LIMIT 100';const query=this.env.DB.prepare(q);const rows=await(history?query.bind(game,mode,u.id):query.bind(game,mode)).all();return rows.results.map((r,i)=>({...r,seeds:JSON.parse(r.seeds),mine:r.user===u.id,user:undefined,rank:history?null:i+1}));}
 async broadcast(){for(const ws of this.ctx.getWebSockets()){try{const u=this.svc.users.get(ws.deserializeAttachment().key);if(!u){ws.send(JSON.stringify({type:'state',state:{active:false,serverNow:Date.now()}}));continue;}const r=this.svc.races.get(u.active);const view=r&&r.players.some(p=>p.id===u.id)?this.svc.view(r,u):{active:false,serverNow:Date.now()};ws.send(JSON.stringify({type:'state',state:await this.decorate(view,u)}));}catch{try{ws.close(1011,'同步失败');}catch{}}}}
 fetch(request){return this.serial(async()=>{try{
  const url=new URL(request.url),op=url.pathname.slice(5),stream=op==='stream';
  this.limit(request.headers.get('X-Race-IP')+':'+(op==='session'?'session':'api'),op==='session'?30:1200);
  if(stream){if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')throw error('需要 WebSocket',426);}
  const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(x=>x.trim());
  const token=stream?protocols.find(x=>x.startsWith('auth.'))?.slice(5):request.headers.get('Authorization')?.replace(/^Bearer /,'');
  await this.account(token);this.svc.sweep();
  if(op==='session'&&request.method==='POST'){await request.text();const auth=this.svc.session(token);await this.persist();return json({...auth,websocket:true});}
  const u=this.svc.auth(token);
  if(stream){if(!protocols.includes('endfield-race'))throw error('无效协议');if(this.ctx.getWebSockets(u.key).length>=3)throw error('打开的竞速窗口过多',429);const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1],[u.key]);pair[1].serializeAttachment({key:u.key});this.svc.state(u);await this.persist();await this.broadcast();return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':'endfield-race'}});}
  if(request.method==='GET'&&['leaderboard','history'].includes(op)){await this.persist();return json(await this.listing(u,url));}
  let result;if(request.method==='GET'&&op==='state')result=this.svc.state(u);
  else {if(request.method!=='POST')throw error('接口不存在',404);const body=await request.text();if(body.length>65536)throw error('请求过大',413);let data;try{data=body?JSON.parse(body):{};}catch{throw error('JSON 无效');}
   if(['solo','create'].includes(op)&&[...this.svc.races.values()].filter(r=>r.status!=='ended').length>=Number(this.env.MAX_ACTIVE_RACES||64))throw error('当前挑战人数较多，请稍后重试。',503);
   const commands={nickname:()=>{this.svc.nickname(u,data.nickname);return {nickname:u.nickname};},solo:()=>this.svc.create(u,data,true),create:()=>this.svc.create(u,data),join:()=>this.svc.join(u,data.code),start:()=>this.svc.start(u),loaded:()=>this.svc.loaded(u,data.round),submit:()=>this.svc.submit(u,data),skip:()=>this.svc.skip(u),leave:()=>this.svc.leave(u),configure:()=>this.svc.configure(u,data),kick:()=>this.svc.kick(u)};
   if(!Object.hasOwn(commands,op))throw error('接口不存在',404);result=commands[op]();
  }
  await this.persist();await this.broadcast();return json(await this.decorate(result,u));
 }catch(e){return json({error:e.status?e.message:'服务暂时不可用，请重试。'},e.status||500);}});}
 webSocketMessage(ws,message){return this.serial(async()=>{try{if(typeof message!=='string'||message.length>1000)throw error('无效消息');this.limit('ws:'+ws.deserializeAttachment().key,30);const data=JSON.parse(message);if(data.type!=='ping')throw error('无效消息');const u=this.svc.users.get(ws.deserializeAttachment().key);if(!u){ws.close(1008,'身份已过期');return;}const view=this.svc.state(u);await this.persist();ws.send(JSON.stringify({type:'state',state:await this.decorate(view,u)}));}catch{ws.close(1008,'请求无效');}});}
 webSocketClose(ws,code){try{ws.close(code);}catch{}}
 webSocketError(ws){try{ws.close(1011,'连接中断');}catch{}}
 alarm(){return this.serial(async()=>{this.svc.sweep();await this.persist();await this.broadcast();});}
}
