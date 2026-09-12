(() => {
  // Action-aligned user-video samples; provenance: audio/sources.json and salvage-sources.json.
  const effects = {
    module: {volume:.62, group:'navigation'},
    level: {volume:.6, group:'navigation'},
    mode: {volume:.48, group:'navigation'},
    ui: {volume:.45, group:'navigation'},
    pick: {volume:.65, group:'game'},
    rotate: {volume:.48, group:'game'},
    drop: {volume:.58, group:'game'},
    invalid: {volume:.45, group:'game'},
    success: {volume:.68, group:'game'},
    'salvage-pick': {volume:.55, group:'game'},
    'salvage-drop': {volume:.6, group:'game'},
    'salvage-ready': {volume:.6, group:'game'},
    'salvage-launch': {volume:.65, group:'game'},
    'salvage-success': {volume:.65, group:'game'},
  };
  const active = new Set();
  const preloads = new Map();
  let muted = false;
  // One persistent music player, independent of screen cleanup and the sound-effects mute.
  const tracks=[{id:'honglu',name:'洪炉',src:'assets/audio/bgm-honglu.mp3'},{id:'sequence-02',name:'春景故人来',src:'assets/audio/bgm.mp3'},{id:'sequence-02-1',name:'衪的指引',src:'assets/audio/bgm-02-1.mp3'}];
  const TRACK_KEY='endfield.music.track.v1';
  let selectedTrack=tracks[0];
  try {selectedTrack=tracks.find(t=>t.id===localStorage.getItem(TRACK_KEY))||tracks[0];}catch{}
  const music = new Audio(selectedTrack.src);
  music.loop = true;
  music.volume = .25;
  music.preload = 'auto';
  music.autoplay = true;
  let musicEnabled = true, musicStarting = false, musicRequest = 0;
  const musicControls=document.createElement('div');musicControls.className='global-music-controls';
  const musicSelect=document.createElement('select');musicSelect.className='global-music-select';musicSelect.setAttribute('aria-label','选择背景音乐');
  for(const track of tracks){const option=document.createElement('option');option.value=track.id;option.textContent=track.name;musicSelect.append(option);}
  musicSelect.value=selectedTrack.id;
  const musicButton = document.createElement('button');
  musicButton.className = 'global-music-toggle';
  musicButton.textContent = '音乐 开';
  musicButton.setAttribute('aria-label','切换背景音乐');
  musicButton.setAttribute('aria-pressed','true');
  musicControls.append(musicSelect,musicButton);document.body.append(musicControls);
  function startMusic() {
    if(!musicEnabled || !music.paused || musicStarting) return;
    musicStarting = true;
    const request=++musicRequest;
    try {
      Promise.resolve(music.play()).catch(()=>{}).finally(()=>{
        if(request!==musicRequest)return;
        musicStarting=false;
        if(!musicEnabled) music.pause();
      });
    } catch { musicStarting=false; }
  }
  musicButton.addEventListener('click',()=>{
    musicEnabled=!musicEnabled;
    music.autoplay=musicEnabled;
    musicButton.textContent=musicEnabled?'音乐 开':'音乐 关';
    musicButton.setAttribute('aria-pressed',String(musicEnabled));
    if(musicEnabled) startMusic(); else music.pause();
  });
  musicSelect.addEventListener('change',()=>{
    const track=tracks.find(t=>t.id===musicSelect.value);if(!track||track.id===selectedTrack.id)return;
    music.pause();musicRequest++;musicStarting=false;selectedTrack=track;
    music.autoplay=musicEnabled;music.src=track.src;music.currentTime=0;
    try{localStorage.setItem(TRACK_KEY,track.id);}catch{}
    startMusic();
  });
  // Retry on subsequent gestures if browser autoplay policy rejects playback.
  for(const event of ['pointerdown','keydown','click']) document.addEventListener(event,e=>{
    if(!musicControls.contains(e.target)) startMusic();
  },true);
  startMusic();
  const source = name => `assets/audio/${name}.wav?v=reference-02-1`;
  for(const name of Object.keys(effects)) {
    const audio=new Audio(source(name));
    audio.preload='auto';
    preloads.set(name,audio);
  }
  function stopWhere(predicate) {
    for(const voice of active) if(predicate(voice)) {
      voice.audio.pause();active.delete(voice);
    }
  }
  function play(name) {
    const effect=effects[name];
    if(muted||!effect) return;
    // Bound overlapping transients when the user moves quickly.
    if(active.size>=8) {
      const oldest=active.values().next().value;
      oldest.audio.pause();active.delete(oldest);
    }
    const audio=new Audio(source(name));
    audio.volume=effect.volume;
    const voice={audio,group:effect.group};
    active.add(voice);
    audio.onended=audio.onerror=()=>active.delete(voice);
    try { const pending=audio.play();pending?.catch(()=>active.delete(voice)); }
    catch { active.delete(voice); }
  }
  window.TerminalAudio = {
    play,
    get muted(){return muted;},
    setMuted(value){muted=Boolean(value);if(muted)stopWhere(()=>true);},
    // Screen transitions stop game tails, but let the selection/confirmation sound finish.
    stopGameplay(){stopWhere(voice=>voice.group==='game');},
  };
})();
