(function(root){
  const normalize = cells => {const x=Math.min(...cells.map(c=>c[0])),y=Math.min(...cells.map(c=>c[1]));return cells.map(c=>[c[0]-x,c[1]-y]);};
  const rotate = cells => {const h=Math.max(...cells.map(c=>c[1]))+1;return normalize(cells.map(([x,y])=>[h-1-y,x]));};
  function centerCell(cells){
    const xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    const mx=xs.reduce((a,b)=>a+b,0)/cells.length,my=ys.reduce((a,b)=>a+b,0)/cells.length;
    const distance=(c,x,y)=>(c[0]-x)**2+(c[1]-y)**2;
    return [...cells].sort((a,b)=>distance(a,cx,cy)-distance(b,cx,cy)||distance(a,mx,my)-distance(b,mx,my)||a[1]-b[1]||a[0]-b[0])[0].slice();
  }
  function initial(level){return level.pieces.map((p,id)=>{let cells=normalize(p.cells);for(let i=0;i<p.turn;i++)cells=rotate(cells);return {id,color:p.color,cells,x:null,y:null};});}
  function canPlace(level,pieces,piece,x,y){
    if(!Number.isInteger(x)||!Number.isInteger(y))return false;
    const busy=new Set([...(level.blocked||[]),...(level.fixed||[])].map(c=>`${c[0]},${c[1]}`));
    pieces.filter(p=>p.id!==piece.id&&p.x!==null).forEach(p=>p.cells.forEach(([cx,cy])=>busy.add(`${p.x+cx},${p.y+cy}`)));
    return piece.cells.every(([cx,cy])=>x+cx>=0&&y+cy>=0&&x+cx<level.size&&y+cy<level.size&&!busy.has(`${x+cx},${y+cy}`));
  }
  function counts(level,pieces){
    const rows={},cols={};for(const color of Object.keys(level.rows)){rows[color]=Array(level.size).fill(0);cols[color]=Array(level.size).fill(0);}
    const add=(x,y,color)=>{if(x>=0&&y>=0&&x<level.size&&y<level.size){rows[color][y]++;cols[color][x]++;}};
    (level.fixed||[]).forEach(([x,y,color])=>add(x,y,color));
    pieces.filter(p=>p.x!==null).forEach(p=>p.cells.forEach(([x,y])=>add(p.x+x,p.y+y,p.color)));
    return {rows,cols};
  }
  function solved(level,pieces){
    if(pieces.some(p=>p.x===null||!canPlace(level,pieces,p,p.x,p.y)))return false;
    const actual=counts(level,pieces);
    return ['rows','cols'].every(axis=>Object.keys(level[axis]).every(color=>level[axis][color].every((target,i)=>actual[axis][color][i]===target)));
  }
  function indicators(target,actual){return Array.from({length:Math.max(target,actual)},(_,i)=>i>=target?'excess':i<actual?'filled':'empty');}
  function bestTime(previous,elapsed){return Number.isFinite(previous)&&previous>0?Math.min(previous,elapsed):elapsed;}
  // Follow external cell edges to draw one continuous polyomino outline.
  function outline(cells,unit=100){
    const set=new Set(cells.map(([x,y])=>`${x},${y}`)),edges=[];
    cells.forEach(([x,y])=>{
      if(!set.has(`${x},${y-1}`))edges.push([[x,y],[x+1,y]]);
      if(!set.has(`${x+1},${y}`))edges.push([[x+1,y],[x+1,y+1]]);
      if(!set.has(`${x},${y+1}`))edges.push([[x+1,y+1],[x,y+1]]);
      if(!set.has(`${x-1},${y}`))edges.push([[x,y+1],[x,y]]);
    });
    let d='';while(edges.length){let [start,end]=edges.shift();d+=`M${start[0]*unit},${start[1]*unit}L${end[0]*unit},${end[1]*unit}`;while(end[0]!==start[0]||end[1]!==start[1]){const i=edges.findIndex(e=>e[0][0]===end[0]&&e[0][1]===end[1]);if(i<0)break;end=edges.splice(i,1)[0][1];d+=`L${end[0]*unit},${end[1]*unit}`;}d+='Z';}return d;
  }
  const api={normalize,rotate,centerCell,initial,canPlace,counts,solved,indicators,bestTime,outline};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RepairCore=api;
})(globalThis);
