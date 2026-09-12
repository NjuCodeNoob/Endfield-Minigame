(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SalvageCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  // Coordinates are zero based. Yellow sockets, inventory and lift copied from WL-A0007.
  const level={id:'wl-a0007',code:'WL-A0007',size:5,lift:4,sockets:[[3,1],[0,2],[1,2],[3,2],[3,3]],balloons:[{id:0,lift:2},{id:1,lift:1},{id:2,lift:1}]};
  const initial=(l=level)=>l.balloons.map(b=>({...b,x:null,y:null}));
  function canPlace(l,items,id,x,y){return Number.isInteger(x)&&Number.isInteger(y)&&l.sockets.some(s=>s[0]===x&&s[1]===y)&&items.some(b=>b.id===id)&&!items.some(b=>b.id!==id&&b.x===x&&b.y===y);}
  function move(l,items,id,x,y){if(!canPlace(l,items,id,x,y))return items;return items.map(b=>b.id===id?{...b,x,y}:b);}
  function canDrop(l,items,id,x,y){return Number.isInteger(x)&&Number.isInteger(y)&&l.sockets.some(s=>s[0]===x&&s[1]===y)&&items.some(b=>b.id===id);}
  function drop(l,items,id,x,y){
    if(!canDrop(l,items,id,x,y))return items;
    const source=items.find(b=>b.id===id),target=items.find(b=>b.id!==id&&b.x===x&&b.y===y);
    return items.map(b=>b.id===id?{...b,x,y}:target&&b.id===target.id?{...b,x:source.x,y:source.y}:b);
  }
  function remove(items,id){return items.map(b=>b.id===id?{...b,x:null,y:null}:b);}
  function evaluate(l,items){
    let lift=0,horizontal=0,vertical=0,placed=0;const center=(l.size-1)/2;
    const valid=items.length===l.balloons.length&&l.balloons.every(ref=>items.filter(b=>b.id===ref.id&&b.lift===ref.lift).length===1)&&items.every(b=>(b.x===null&&b.y===null)||canPlace(l,items,b.id,b.x,b.y));
    for(const b of items){if(b.x===null||b.y===null)continue;placed++;lift+=b.lift;horizontal+=b.lift*(b.x-center);vertical+=b.lift*(b.y-center);}
    const all=placed===l.balloons.length,balanced=horizontal===0&&vertical===0;
    return {lift,horizontal,vertical,placed,all,balanced,valid,ready:valid&&all&&lift>=l.lift&&balanced};
  }
  return {level,initial,canPlace,move,canDrop,drop,remove,evaluate};
});
