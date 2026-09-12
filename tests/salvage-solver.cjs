// Independent finite search for reference-data validation, not exposed in gameplay.
module.exports=function solve(level){
  const sockets=[...level.sockets].sort((a,b)=>Math.abs(b[0]-2)+Math.abs(b[1]-2)-Math.abs(a[0]-2)-Math.abs(a[1]-2));
  const values=[...new Set(level.balloons.map(b=>b.lift))].sort((a,b)=>b-a);values.push(0);
  const counts=values.map(v=>v?level.balloons.filter(b=>b.lift===v).length:sockets.length-level.balloons.length),chosen=[],seen=new Set();
  function visit(i,h,v){
    if(i===sockets.length)return h===0&&v===0;
    const key=`${i}|${counts.join(',')}|${h},${v}`;if(seen.has(key))return false;
    const weights=values.flatMap((value,j)=>Array(counts[j]).fill(value)).sort((a,b)=>a-b);
    for(const [axis,moment] of [[0,h],[1,v]]){const distances=sockets.slice(i).map(p=>p[axis]-2).sort((a,b)=>a-b);let min=0,max=0;for(let j=0;j<weights.length;j++){max+=weights[j]*distances[j];min+=weights[j]*distances[weights.length-1-j];}if(moment+min>0||moment+max<0)return false;}
    const [x,y]=sockets[i];
    for(let j=0;j<values.length;j++){if(!counts[j])continue;const value=values[j];counts[j]--;chosen.push({x,y,lift:value});if(visit(i+1,h+value*(x-2),v+value*(y-2)))return true;chosen.pop();counts[j]++;}
    seen.add(key);return false;
  }
  if(!visit(0,0,0))return null;
  const remaining=chosen.filter(p=>p.lift);
  return level.balloons.map(b=>{const i=remaining.findIndex(p=>p.lift===b.lift);return {...b,...remaining.splice(i,1)[0]};});
};
