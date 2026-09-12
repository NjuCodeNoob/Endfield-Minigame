const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/repair-core.js');
const levels = require('../dist/repair-levels.js');
const solution = l => l.pieces.map((p,id)=>({id,color:p.color,cells:C.normalize(p.cells),x:Math.min(...p.cells.map(c=>c[0])),y:Math.min(...p.cells.map(c=>c[1]))}));
const sorted = cells => cells.map(c=>c.join(',')).sort();
for (const level of levels) {
  test(`${level.id}: recorded layout matches every row and column and can be assembled from tray rotations`,()=>{
    const state=C.initial(level), solved=solution(level);
    assert.equal(C.solved(level,state),false);
    for(const target of solved){
      const part=state[target.id];let turns=0;
      while(JSON.stringify(sorted(part.cells))!==JSON.stringify(sorted(target.cells))&&turns<4){part.cells=C.rotate(part.cells);turns++;}
      assert.ok(turns<4,'reference shape reachable by rotation alone');
      assert.ok(C.canPlace(level,state,part,target.x,target.y));part.x=target.x;part.y=target.y;
    }
    assert.equal(C.solved(level,state),true);
    const count=C.counts(level,state);assert.deepEqual(count.rows,level.rows);assert.deepEqual(count.cols,level.cols);
    state[0].x=null;assert.equal(C.solved(level,state),false);
  });
}
test('rotation preserves occupied cells after a full turn',()=>{for(const l of levels)for(const p of C.initial(l)){let cells=p.cells;for(let i=0;i<4;i++)cells=C.rotate(cells);assert.deepEqual(sorted(cells),sorted(p.cells));}});
test('rejects board overflow, overlap, blocked and locked cells',()=>{
  const level=levels.find(l=>l.id==='wl0016-a'),state=C.initial(level),p=state[0];
  assert.equal(C.canPlace(level,state,p,-1,0),false);
  assert.equal(C.canPlace(level,state,p,3,3),false);
  assert.equal(C.canPlace(level,state,p,1,1),false);
  p.x=0;p.y=0;assert.equal(C.canPlace(level,state,state[1],0,0),false);
  const locked=levels.find(l=>l.id==='wl0017'),ps=C.initial(locked);assert.equal(C.canPlace(locked,ps,ps[0],0,0),false);
});
test('color overflow is allowed spatially but cannot win',()=>{
  const l=levels.find(l=>l.id==='wl0016-a'),ps=solution(l);
  [ps[0].color,ps[2].color]=[ps[2].color,ps[0].color];
  assert.ok(ps.every(p=>C.canPlace(l,ps,p,p.x,p.y)));assert.equal(C.solved(l,ps),false);
  assert.ok(C.counts(l,ps).rows.amber[0]>l.rows.amber[0]);
});
test('indicators show each excess cell separately, including zero-target colors',()=>{
  assert.deepEqual(C.indicators(2,4),['filled','filled','excess','excess']);
  assert.deepEqual(C.indicators(4,1),['filled','empty','empty','empty']);
  assert.deepEqual(C.indicators(0,2),['excess','excess']);
});
test('fixed cells count before any movable pieces are placed',()=>{
  const l=levels.find(l=>l.id==='wl0017'),actual=C.counts(l,C.initial(l));
  assert.deepEqual(actual.rows.cyan,[0,0,0,1]);assert.deepEqual(actual.rows.amber,[2,0,0,1]);
});
test('best record survives slower replays and updates only for faster completions',()=>{
  assert.equal(C.bestTime(null,12500),12500);assert.equal(C.bestTime(12500,17500),12500);assert.equal(C.bestTime(12500,9000),9000);
});
test('continuous outlines contain no internal cell edges',()=>{
  assert.equal(C.outline([[0,0],[1,0]]).split('M').length-1,1);
  assert.ok(!C.outline([[0,0],[1,0]]).includes('L100,100L100,0'));
});
test('drag anchors always select an occupied cell nearest the bounding-box center in every orientation',()=>{
  for(const level of levels)for(const p of C.initial(level)){
    let cells=p.cells;
    for(let turn=0;turn<4;turn++){
      const anchor=C.centerCell(cells),cx=Math.max(...cells.map(c=>c[0]))/2,cy=Math.max(...cells.map(c=>c[1]))/2;
      const d=c=>(c[0]-cx)**2+(c[1]-cy)**2;
      assert.ok(cells.some(c=>c[0]===anchor[0]&&c[1]===anchor[1]));
      assert.equal(d(anchor),Math.min(...cells.map(d)));
      cells=C.rotate(cells);
    }
  }
  assert.deepEqual(C.centerCell([[1,0],[0,1],[1,1],[2,1],[1,2]]),[1,1]);
});
