const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('HTML, CSS and clean interface audio reference existing local files',()=>{
  const root=path.resolve(__dirname,'../dist');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
  for(const file of ['style.css','repair.css','custom.css']){
    const css=fs.readFileSync(path.join(root,file),'utf8');
    refs.push(...[...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(m=>m[1]));
  }
  const sources=JSON.parse(fs.readFileSync(path.join(root,'assets/audio/sources.json'),'utf8'));
  refs.push(...Object.keys(sources.sounds).map(x=>`assets/audio/${x}.wav`));
  refs.push('assets/audio/bgm-honglu.mp3','assets/audio/bgm.mp3','assets/audio/bgm-02-1.mp3');
  for(const ref of refs){if(ref.startsWith('#'))continue;assert.ok(fs.statSync(path.join(root,ref)).size>0,ref);}
});
test('every sound matches its recorded reference cut and contains unclipped stereo PCM',()=>{
  const root=path.resolve(__dirname,'../dist/assets/audio'),sources=JSON.parse(fs.readFileSync(path.join(root,'sources.json'),'utf8')),hashes=new Set();
  assert.equal(sources.source,'序列 02_1.mp4');
  for(const [name,meta] of Object.entries(sources.sounds)){
    const wav=fs.readFileSync(path.join(root,name+'.wav'));
    assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
    assert.ok(meta.duration>0&&meta.duration<2);assert.ok(meta.peak_dbfs<=-10);
    assert.ok(Math.abs(meta.duration-(meta.end_seconds-meta.start_seconds))<.002);
    assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),48000);
    const hash=require('node:crypto').createHash('sha256').update(wav).digest('hex');
    assert.equal(hash,meta.sha256);hashes.add(hash);
  }
  assert.equal(hashes.size,Object.keys(sources.sounds).length);
});
