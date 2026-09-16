'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const G=require('./generator.cjs');
const id=()=>crypto.randomBytes(18).toString('hex'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const fail=(message,status=400)=>{const e=Error(message);e.status=status;throw e;};
class RaceService{
 constructor({file=null,now=Date.now,generate=G.generate}={}){this.file=file;this.now=now;this.generate=generate;this.users=new Map();this.races=new Map();this.rooms=new Map();this.records=[];
  if(file&&fs.existsSync(file)){const d=JSON.parse(fs.readFileSync(file,'utf8'));this.users=new Map(d.users.map(u=>[u.key,{...u,active:null}]));this.records=d.records;}
 }
 persist(){if(!this.file)return;fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({users:[...this.users.values()].map(({active,...u})=>u),records:this.records}));fs.renameSync(this.file+'.tmp',this.file);}
 session(token){let u=this.users.get(hash(token||''));if(u)return {token,user:u.id,nickname:u.nickname};token=id();u={id:id(),key:hash(token),nickname:'管理员'+crypto.randomBytes(2).toString('hex'),active:null};this.users.set(u.key,u);this.persist();return {token,user:u.id,nickname:u.nickname};}
 auth(token){const u=this.users.get(hash(token||''));if(!u)fail('登录状态失效，请重新连接。',401);return u;}
 nickname(u,name){name=String(name||'').normalize('NFC').trim();if(!name||[...name].length>20||/[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name))fail('昵称须为 1–20 字，不可含控制字符或尖括号。');u.nickname=name;this.persist();}
 idle(u){const r=this.races.get(u.active);if(r&&r.players.some(p=>p.id===u.id)&&r.status!=='ended')fail('请先退出当前挑战或房间。');u.active=null;}
 options(o,solo){if(!['repair','salvage'].includes(o.game)||!['easy','chaos'].includes(o.mode))fail('游戏或难度无效');if(!solo&&![5,7,9].includes(o.count))fail('仅支持 BO5、BO7、BO9');return {game:o.game,mode:o.mode,count:solo?5:o.count};}
 player(u){return {id:u.id,nickname:u.nickname,score:0,seen:this.now(),loaded:false,skip:false};}
 create(u,o,solo=false){this.idle(u);const opts=this.options(o,solo),r={id:id(),...opts,solo,host:u.id,players:[this.player(u)],status:solo?'loading':'lobby',round:0,log:[],createdAt:this.now(),updatedAt:this.now(),bank:[],startAt:null};
  if(!solo){do{r.code=crypto.randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(r.code));this.rooms.set(r.code,r.id);}
  this.races.set(r.id,r);u.active=r.id;if(solo)this.start(u,r);return this.view(r,u);
 }
 join(u,code){this.idle(u);const r=this.races.get(this.rooms.get(String(code||'').trim().toUpperCase()));if(!r)fail('房间不存在或已过期。');if(r.status!=='lobby'||r.players.length>=2)fail('房间已满或比赛已经开始。');r.players.push(this.player(u));u.active=r.id;return this.view(r,u);}
 current(u){const r=this.races.get(u.active);if(!r||!r.players.some(p=>p.id===u.id))fail('你已离开房间。',404);return r;}
 start(u,r=this.current(u)){
  if(r.closed)fail('对方已离开，请创建新房间。');if(r.host!==u.id)fail('只有房主可以开始。',403);if(!['lobby','ended','loading'].includes(r.status)||(!r.solo&&r.players.length!==2))fail('请等待另一名玩家加入。');
  if(r.status==='loading'&&r.bank.length)fail('已经开始。');
  r.match=id();r.bank=Array.from({length:r.count},()=>this.generate(r.game,r.mode));r.players.forEach(p=>{p.score=0;p.seen=this.now();});r.round=0;r.log=[];r.startAt=null;r.result=null;r.record=null;this.round(r);return this.view(r,u);
 }
 round(r){r.status='loading';r.readyAt=null;r.roundAt=this.now();r.updatedAt=this.now();r.players.forEach(p=>{p.loaded=false;p.skip=false;});r.public=G.publicLevel(r.bank[r.round],r.id+'-'+r.match+'-'+r.round);}
 sweep(){const now=this.now();for(const r of this.races.values()){
  if(r.status==='ended')continue;
  if(r.status==='lobby'){if(now-r.createdAt>30*60e3)this.end(r,null,'房间等待超时');continue;}
  const lost=r.players.filter(p=>now-p.seen>20000);
  if(lost.length){this.end(r,r.solo||lost.length===r.players.length?null:r.players.find(p=>!lost.includes(p)).id,'掉线判负');continue;}
  if(r.status==='loading'&&now-r.roundAt>30000){const loaded=r.players.filter(p=>p.loaded);this.end(r,!r.solo&&loaded.length===1?loaded[0].id:null,'加载超时');continue;}
  if(r.readyAt&&now-r.readyAt>300000){if(r.solo)this.end(r,null,'作答超时');else this.advance(r,null,'本题超时，双方不计分');}
  if(r.status==='countdown'&&now>=r.readyAt)r.status='playing';
 }
 for(const [rid,r] of this.races)if(r.status==='ended'&&now-r.updatedAt>3600000){this.races.delete(rid);if(r.code)this.rooms.delete(r.code);}
 }
 state(u){this.sweep();const r=this.races.get(u.active);if(!r||!r.players.some(p=>p.id===u.id))return {active:false,serverNow:this.now()};r.players.find(p=>p.id===u.id).seen=this.now();return this.view(r,u);}
 loaded(u,round){const r=this.current(u);if(round!==r.round)return this.view(r,u);if(r.status!=='loading')return this.view(r,u);r.players.find(p=>p.id===u.id).loaded=true;if(r.players.every(p=>p.loaded)){r.readyAt=this.now()+(r.solo&&r.round>0?0:3000);if(r.startAt===null)r.startAt=r.readyAt;r.status='countdown';}return this.view(r,u);}
 submit(u,o){this.sweep();const r=this.current(u);if(o.round!==r.round)return this.view(r,u);if(!['playing','countdown'].includes(r.status)||this.now()<r.readyAt)fail('倒计时尚未结束或本题已结束。');if(!G.verify(r.game,r.bank[r.round].level,o.state))fail('答案未通过服务器校验，请检查布局。');this.advance(r,u.id,'解答成功');return this.view(r,u);}
 advance(r,winner,reason){if(winner)r.players.find(p=>p.id===winner).score++;r.log.push({round:r.round,winner,reason,elapsed:Math.max(0,this.now()-r.readyAt)});
  const threshold=(r.count+1)/2;if(r.round+1===r.count||(!r.solo&&r.players.some(p=>p.score>=threshold))){let win=winner;if(!r.solo){const [a,b]=r.players;win=a.score===b.score?null:a.score>b.score?a.id:b.id;}this.end(r,win,'比赛结束');if(r.solo){const elapsed=Math.max(1,this.now()-r.startAt);r.record={id:id(),user:r.players[0].id,nickname:r.players[0].nickname,game:r.game,mode:r.mode,elapsed,at:this.now(),seeds:r.bank.map(p=>p.seed)};this.records.push(r.record);this.persist();}return;}
  r.round++;this.round(r);
 }
 skip(u){const r=this.current(u);if(r.solo||!['playing','countdown'].includes(r.status)||this.now()<r.readyAt)fail('当前不能跳过。');const p=r.players.find(p=>p.id===u.id);p.skip=!p.skip;if(r.players.every(p=>p.skip))this.advance(r,null,'双方同意跳过');return this.view(r,u);}
 end(r,winner,reason){r.status='ended';r.updatedAt=this.now();r.result={winner,reason};}
 leave(u){const r=this.races.get(u.active);u.active=null;if(!r||!r.players.some(p=>p.id===u.id))return {active:false};if(r.status==='ended'){r.closed=true;if(r.code)this.rooms.delete(r.code);return {active:false};}if(r.status==='lobby'){if(r.host===u.id){this.end(r,null,'房主退出');if(r.code)this.rooms.delete(r.code);}else r.players=r.players.filter(p=>p.id!==u.id);}else this.end(r,r.solo?null:r.players.find(p=>p.id!==u.id)?.id||null,'玩家退出，判负');return {active:false};}
 configure(u,o){const r=this.current(u);if(r.host!==u.id||r.status!=='lobby')fail('仅房主可在等待时修改设置。');const opts=this.options({...r,...o},false);Object.assign(r,opts);return this.view(r,u);}
 kick(u){const r=this.current(u);if(r.host!==u.id||r.status!=='lobby')fail('仅房主可在等待时移出玩家。');const removed=r.players.filter(p=>p.id!==u.id);for(const user of this.users.values())if(removed.some(p=>p.id===user.id))user.active=null;r.players=r.players.filter(p=>p.id===u.id);return this.view(r,u);}
 results(u,game,mode,history=false){const rows=this.records.filter(r=>r.game===game&&r.mode===mode&&(!history||r.user===u.id));return rows.sort(history?(a,b)=>b.at-a.at:(a,b)=>a.elapsed-b.elapsed||a.at-b.at).slice(0,100).map((r,i)=>({...r,user:undefined,rank:history?null:i+1,mine:r.user===u.id}));}
 view(r,u){const record=r.record,all=record?this.records.filter(x=>x.game===r.game&&x.mode===r.mode).sort((a,b)=>a.elapsed-b.elapsed||a.at-b.at):[],own=all.filter(x=>x.user===u.id);return {active:true,canRematch:!r.closed,id:r.id+(r.match||''),code:r.code,game:r.game,mode:r.mode,count:r.count,solo:r.solo,host:r.host,players:r.players.map(({seen,...p})=>p),status:r.status,round:r.round,serverNow:this.now(),readyAt:r.readyAt,startAt:r.startAt,level:r.status!=='ended'&&r.status!=='lobby'?r.public:null,log:r.log,result:r.result,elapsed:record?.elapsed,rank:record?all.indexOf(record)+1:null,best:own.length?Math.min(...own.map(x=>x.elapsed)):null,newBest:record?own.every(x=>x===record||x.elapsed>record.elapsed):false,review:r.status==='ended'?r.bank.map(p=>({seed:p.seed,level:p.level,answer:p.answer})):null};}
}
module.exports={RaceService};
