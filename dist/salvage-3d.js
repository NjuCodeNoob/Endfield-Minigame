(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Salvage3D=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const CAMERA=1000,THICKNESS=10;
  const outline=[[4,4],[16,4],[16,12],[64,12],[64,4],[76,4],[76,76],[64,76],[64,68],[16,68],[16,76],[4,76]];
  // Local XY mesh, extruded along Z. Camera looks at the board's center from +Z.
  function rotate(p,pitch,yaw){const [x,y,z]=p,cx=Math.cos(pitch),sx=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw),yy=y*cx-z*sx,zz=y*sx+z*cx;return [x*cy+zz*sy,yy,-x*sy+zz*cy];}
  function project(p,pitch=0,yaw=0){const [x,y,z]=rotate(p,pitch,yaw),scale=CAMERA/(CAMERA-z);return {x:300+x*scale,y:300+y*scale,z,scale};}
  function unproject(x,y,pitch=0,yaw=0){
    const n=rotate([0,0,1],pitch,yaw),dir=[(x-300)/CAMERA,(y-300)/CAMERA,-1],den=n[0]*dir[0]+n[1]*dir[1]+n[2]*dir[2];
    if(Math.abs(den)<1e-8)return null;
    const t=-CAMERA*n[2]/den,p=[dir[0]*t,dir[1]*t,CAMERA-t],cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),xx=p[0]*cy-p[2]*sy,zz=p[0]*sy+p[2]*cy;
    return {x:xx+300,y:p[1]*cx+zz*sx+300};
  }
  function target(horizontal,vertical,lift){const normalizer=Math.max(3,lift*.8);return {pitch:Math.tanh(vertical/normalizer)*.49,yaw:Math.tanh(-horizontal/normalizer)*.62};}
  function step(state,goal,dt){dt=Math.min(.032,Math.max(0,dt));for(const [axis,velocity] of [['pitch','vp'],['yaw','vy']]){state[velocity]+=(100*(goal[axis]-state[axis])-15*state[velocity])*dt;state[axis]+=state[velocity]*dt;}return state;}
  const path=points=>points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')+'Z';
  function mesh(x,y,pitch,yaw){
    const points=outline.map(([px,py])=>[x*80-200+px,y*80-200+py,0]);
    const top=points.map(p=>project(p,pitch,yaw)),bottom=points.map(p=>project([p[0],p[1],-THICKNESS],pitch,yaw));
    const faces=points.map((p,i)=>{const j=(i+1)%points.length;return {d:path([top[i],bottom[i],bottom[j],top[j]]),depth:(top[i].z+top[j].z)/2,shade:Math.round(28+12*Math.abs(Math.sin(i+pitch+yaw)))};}).sort((a,b)=>a.depth-b.depth);
    return {top:path(top),faces,depth:top.reduce((s,p)=>s+p.z,0)/top.length};
  }
  function circle(x,y,r,pitch,yaw){return path(Array.from({length:28},(_,i)=>{const a=i*Math.PI/14;return project([x+r*Math.cos(a)-300,y+r*Math.sin(a)-300,.4],pitch,yaw);}));}
  function create(svg,level){
    const state={pitch:0,yaw:0,vp:0,vy:0},goal={pitch:0,yaw:0};let frame=0,last=0,alive=true,placed=[],stats={lift:0,horizontal:0,vertical:0,placed:0},preview=null;
    const platform=svg.querySelector('.salvage-platform'),tiles=svg.querySelector('.salvage-tiles'),axes=svg.querySelector('.salvage-axes'),moments=svg.querySelector('.salvage-moments'),attached=svg.querySelector('.salvage-attached');
    platform.style.transform='none';svg.classList.add('mesh-renderer');
    const tileNodes=[...tiles.children];
    tileNodes.forEach(el=>{el.removeAttribute('transform');const edges=document.createElementNS('http://www.w3.org/2000/svg','g');edges.classList.add('plate-sides');el.insertBefore(edges,el.firstChild);for(const circle of [...el.querySelectorAll('circle')]){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('class',circle.classList.contains('socket-dot')?'socket-dot':'socket-ring');circle.replaceWith(p);}});
    function point(x,y,z=0){return project([x-300,y-300,z],state.pitch,state.yaw);}
    function line(points){return points.map((p,i)=>{const q=point(...p);return `${i?'L':'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;}).join('');}
    function draw(){
      for(const el of tileNodes){const x=+el.dataset.x,y=+el.dataset.y,m=mesh(x,y,state.pitch,state.yaw);el.querySelector('.plate-sides').innerHTML=m.faces.map(f=>`<path d="${f.d}" fill="rgb(${f.shade},${f.shade+3},${f.shade+3})"/>`).join('');el.querySelector(':scope > path').setAttribute('d',m.top);el.querySelector('.socket-ring')?.setAttribute('d',circle(140+x*80,140+y*80,7,state.pitch,state.yaw));el.querySelector('.socket-dot')?.setAttribute('d',circle(140+x*80,140+y*80,4,state.pitch,state.yaw));}
      const p=point(300,49,3),badge=svg.querySelector('.salvage-lift');badge.setAttribute('transform',`translate(${p.x-85*p.scale} ${p.y-16*p.scale}) scale(${p.scale}) rotate(${state.yaw*8})`);
      svg.querySelector('.salvage-corners').setAttribute('d',[[92,92],[508,92],[92,508],[508,508]].map(([x,y])=>{const q=point(x,y);return `M${q.x-2} ${q.y-2}h4v4h-4Z`;}).join(''));
      for(const el of attached.children){const b=placed.find(b=>b.id===+el.dataset.id);if(!b)continue;const q=point(140+b.x*80,140+b.y*80,5);el.setAttribute('transform',`translate(${q.x-42*q.scale} ${q.y-42*q.scale}) scale(${q.scale})`);}
      const s=preview||stats;
      axes.innerHTML=[['horizontal',s.horizontal],['vertical',s.vertical]].map(([axis,n])=>{const horizontal=axis==='horizontal',off=Math.max(-172,Math.min(172,n*22)),color=n?'#ee9b0d':s.placed?'#55d1bd':'#65706d',a=horizontal?[115,521]:[87,115],b=horizontal?[485,521]:[87,485],c=horizontal?[300+off,521]:[87,300+off],q=point(...c);return `<g style="color:${color}"><path d="${line([a,b])}" stroke="currentColor" stroke-width="9" opacity=".16"/><path d="${line([a,b])}" stroke="currentColor" stroke-width="1" opacity=".5"/><path d="${line([horizontal?[300,521]:[87,300],c])}" stroke="currentColor" stroke-width="4"/><circle cx="${q.x}" cy="${q.y}" r="5" fill="#233332" stroke="currentColor" stroke-width="2"/>${true?`<text x="${q.x+(horizontal?0:-15)}" y="${q.y+(horizontal?20:4)}" fill="currentColor" font-size="12" text-anchor="middle">${Math.abs(n)} ${n===0?'':horizontal?(n<0?'◀':'▶'):(n<0?'▲':'▼')}</text>`:''}</g>`;}).join('');
      moments.innerHTML=[1,2].map(r=>{const color=(s.horizontal===0&&s.vertical===0)?'#4ccbb3':r===2?'#c67816':'#dfb320',e=r*80+40;return `<path d="${line([[300-e,300-e],[300+e,300-e],[300+e,300+e],[300-e,300+e],[300-e,300-e]])}" fill="none" stroke="${color}" stroke-width="1.7" opacity="${s.placed?.48:0}"/>`;}).join('');
    }
    function tick(time){if(!alive)return;const dt=last?Math.min(.032,(time-last)/1000):1/60;last=time;step(state,goal,dt);draw();const moving=Math.abs(state.pitch-goal.pitch)+Math.abs(state.yaw-goal.yaw)+Math.abs(state.vp)+Math.abs(state.vy)>.0003;if(moving)frame=requestAnimationFrame(tick);else{state.pitch=goal.pitch;state.yaw=goal.yaw;frame=0;last=0;draw();}}
    function setTarget(s){Object.assign(goal,target(s.horizontal,s.vertical,s.lift));if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches){Object.assign(state,goal,{vp:0,vy:0});draw();return;}if(!frame)frame=requestAnimationFrame(tick);draw();}
    draw();
    return {update(items,s){placed=items;stats=s;preview=null;setTarget(s);},preview(s){preview=s;setTarget(s||stats);},hit(x,y){let q;try{const p=svg.createSVGPoint();p.x=x;p.y=y;q=p.matrixTransform(svg.getScreenCTM().inverse());}catch{return null;}const local=unproject(q.x,q.y,state.pitch,state.yaw);if(!local)return null;const col=Math.floor((local.x-100)/80),row=Math.floor((local.y-100)/80);return col>=0&&col<level.size&&row>=0&&row<level.size?[col,row]:null;},dispose(){alive=false;cancelAnimationFrame(frame);},state};
  }
  return {rotate,project,unproject,target,step,mesh,create};
});
