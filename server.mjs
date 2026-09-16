import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{RaceService}=require('./backend/race-service.cjs');
const root=path.resolve('dist'),service=new RaceService({file:path.resolve(process.env.RACE_DATA_FILE||'.race-data/store.json')});
const allowed=new Set((process.env.ALLOWED_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173,https://njucodenoob.github.io').split(','));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg'};
const limits=new Map();
const timer=setInterval(()=>{service.sweep();for(const [k,v] of limits)if(Date.now()-v.at>60000)limits.delete(k);},1000);timer.unref();
const server=http.createServer(async(req,res)=>{
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   const origin=req.headers.origin;if(origin&&!allowed.has(origin)&&origin!=='http://'+req.headers.host&&origin!=='https://'+req.headers.host)return json({error:'此站点未获服务器允许。'},403);
   if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
   if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
   const key=(req.socket.remoteAddress||'local')+(url.pathname==='/api/session'?':session':':api'),limit=limits.get(key)||{at:Date.now(),n:0};if(Date.now()-limit.at>60000){limit.at=Date.now();limit.n=0;}limit.n++;limits.set(key,limit);if(limit.n>(key.endsWith(':session')?30:1600))return json({error:'请求过于频繁，请稍后再试。'},429);
   let data={};if(req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536)return json({error:'请求过大。'},413);}try{data=body?JSON.parse(body):{};}catch{return json({error:'JSON 无效'},400);}}
   const token=req.headers.authorization?.replace(/^Bearer /,'');
   if(url.pathname==='/api/health')return json({ok:true,version:1});
   if(url.pathname==='/api/session'&&req.method==='POST')return json(service.session(token));
   const u=service.auth(token);service.sweep();
   if(req.method==='GET'){
    if(url.pathname==='/api/state')return json(service.state(u));
    if(url.pathname==='/api/leaderboard'||url.pathname==='/api/history')return json(service.results(u,url.searchParams.get('game'),url.searchParams.get('mode'),url.pathname==='/api/history'));
   }
   if(req.method!=='POST')return json({error:'接口不存在'},404);
   const methods={nickname:()=>{service.nickname(u,data.nickname);return {nickname:u.nickname};},solo:()=>service.create(u,data,true),create:()=>service.create(u,data),join:()=>service.join(u,data.code),start:()=>service.start(u),loaded:()=>service.loaded(u,data.round),submit:()=>service.submit(u,data),skip:()=>service.skip(u),leave:()=>service.leave(u),configure:()=>service.configure(u,data),kick:()=>service.kick(u)};
   const method=methods[url.pathname.slice(5)];if(!method)return json({error:'接口不存在'},404);return json(method());
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
 }catch(e){if(req.url.startsWith('/api/'))json({error:e.status?e.message:'服务器处理失败，请重试。'},e.status||500);else res.writeHead(404).end('Not found');}
});
server.listen(Number(process.env.PORT||5173),process.env.HOST||'127.0.0.1',()=>console.log('Terminal + Race API: port '+(process.env.PORT||5173)));
