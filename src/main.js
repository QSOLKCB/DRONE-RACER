// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../engine/time/index.js';
import {rotate,quatConjugate} from '../engine/math/index.js';
import {createSession,setFlightMode,stepSession,recoverSession,secondsFromTicks,STEP} from './game.js';
import {RaceRenderer,QUALITY,drawMap} from './scene.js';
import {compilePack} from './mods.js';
import {PRESETS} from './courses.js';
import {compileSkinPack,BUILTIN_SKINS,DEFAULT_SKIN_PACK,SKIN_LIMIT} from './skins.js';
import {presetRecordKey,importedRecordKey} from './records.js';
import {RaceAudio,SoundEventLog} from './audio.js';
import {readPreferences,savePreferences,gamepadCommand} from './preferences.js';
const q=id=>document.querySelector('#'+id);
const canvas=q('flight'),hud=q('hud'),notice=q('notice'),overlay=q('overlay');
const pauseButton=q('pause'),modeButton=q('mode'),viewButton=q('view-mode'),packSelect=q('pack-select');
const keys=new Set(),touch=new Set(),clock=new FixedClock({step:STEP,maxFrame:.12,maxSteps:6});
let storage;try{storage=globalThis.localStorage;}catch{}
const prefs=readPreferences(storage),audio=new RaceAudio();audio.setVolume(prefs.volume);audio.music=prefs.music;
let session,started=false,paused=true,previous=performance.now(),lastHUD=-Infinity;
let activeSource=PRESETS.neon,activePack=compilePack(activeSource),activeRecordKey=presetRecordKey('neon');
let importGeneration=0,skinGeneration=0,skinPack=BUILTIN_SKINS,skinSource=DEFAULT_SKIN_PACK;
let skin=skinPack.skins.find(s=>s.id===prefs.skin)??skinPack.skins[0],soundLog=new SoundEventLog(),assisted=true;
const renderer=new RaceRenderer(canvas,{onMode:mode=>{
  if(q('backend-status'))q('backend-status').textContent=mode==='cpu'?'CPU · Canvas 2D':'WebGPU + WASM · active';
  if(q('backend'))q('backend').value=mode==='cpu'?'cpu':'gpu';
}});
renderer.setQuality(prefs.quality);renderer.setSkin(skin);
function persist(){savePreferences(storage,prefs);}
function best(){try{const n=Number(storage?.getItem(activeRecordKey));return Number.isSafeInteger(n)&&n>0?n:null;}catch{return null;}}
function saveBest(n){try{storage?.setItem(activeRecordKey,String(n));}catch{}}
function clearInputs(){keys.clear();touch.clear();}
function setText(id,text){if(q(id))q(id).textContent=text;}
function updateHUD(){
  if(!session)return;
  const r=session.race,g=session.track.gates[Math.min(r.nextGate,session.track.gates.length-1)];
  hud.textContent='LAP '+Math.min(r.completedLaps+1,session.track.laps)+'/'+session.track.laps+
    ' · GATE '+Math.min(r.nextGate+1,session.track.gates.length)+'/'+session.track.gates.length+
    ' · '+secondsFromTicks(r.ticks)+'s · '+Math.hypot(...session.body.velocity).toFixed(1)+' m/s'+
    ' · '+(session.assisted?'ASSISTED':'INERTIAL')+' · BEST '+(secondsFromTicks(r.bestTicks)??'--')+'s';
  const delta=[g.x,g.y,g.z].map((n,i)=>n-session.body.position[i]);
  const local=rotate(quatConjugate(session.body.orientation),delta),angle=Math.atan2(local[0],-local[2])*180/Math.PI;
  setText('gate-guide',(Math.abs(angle)>100?'TURN BACK':angle>20?'TURN RIGHT':angle< -20?'TURN LEFT':'AHEAD')+
    ' · '+Math.round(Math.hypot(...delta))+' m · '+g.id.toUpperCase());
  setText('lap-splits',r.lapTimes.length?'LAPS '+r.lapTimes.map((t,i)=>(i+1)+': '+secondsFromTicks(t)+'s').join(' / '):'Clear every gate to complete a lap');
  setText('penalty',r.recoveries?'RECOVERY +'+secondsFromTicks(r.penaltyTicks)+'s':'');
  setText('skin-name',skin.name);
  if(q('progress'))q('progress').value=r.clearedGates/(session.track.gates.length*session.track.laps);
}
function pause(on){
  if(!started||(!on&&session.race.status!=='running'))return;
  paused=Boolean(on);clock.setPaused(paused);clearInputs();audio.pause();
  if(!paused)previous=performance.now();
  notice.textContent=paused?'PAUSED — PRESS RESUME':session.race.clearedGates?
    'GATE CLEARED · '+session.race.nextGate+'/'+session.track.gates.length:'FLY THROUGH EACH GATE IN ORDER';
  pauseButton.textContent=paused?'Resume':'Pause';updateHUD();
}
function freshSession(){
  session=createSession(activePack.track,best(),activePack.drone);session.accent=activePack.accent;
  session.camera=prefs.camera;setFlightMode(session,assisted);renderer.invalidate();
  syncSkin();
  if(viewButton)viewButton.textContent='View: '+(session.camera==='chase'?'Chase':'FPV');
  modeButton.textContent='Mode: '+(assisted?'Assisted':'Inertial');
}
function reset(){
  audio.pause();freshSession();soundLog=new SoundEventLog();clock.reset();clock.setPaused(false);
  started=true;paused=false;clearInputs();overlay.hidden=true;
  if(q('results'))q('results').hidden=true;
  pauseButton.textContent='Pause';pauseButton.disabled=false;
  notice.textContent='FLY THROUGH EACH GATE IN ORDER';previous=performance.now();updateHUD();
}
function recover(){
  if(!started||paused||!recoverSession(session))return;
  clearInputs();audio.pause();soundLog.append(session);audio.update(session);renderer.invalidate();
  notice.textContent='RECOVERED AT LAST CHECKPOINT · +5.00s';updateHUD();
}
function down(k){return keys.has(k)||touch.has(k);}
function axis(p,n){return Number(down(p))-Number(down(n));}
function command(){
  if(isFormControl(document.activeElement))return {thrust:[0,0,0],turn:[0,0,0],brake:false};
  let pad;try{pad=Array.from(globalThis.navigator?.getGamepads?.()??[]).find(p=>p?.mapping==='standard');}catch{}
  const analog=gamepadCommand(pad);
  const combine=(a,b)=>a.map((n,i)=>Math.max(-1,Math.min(1,n+b[i])));
  return {thrust:combine([axis('KeyD','KeyA'),axis('KeyE','KeyQ'),axis('KeyS','KeyW')],analog.thrust),
    turn:combine([axis('ArrowDown','ArrowUp'),axis('ArrowLeft','ArrowRight'),axis('KeyC','KeyV')],analog.turn).map(n=>Math.max(-1,Math.min(1,n*prefs.sensitivity))),
    brake:down('Space')||analog.brake};
}
function packInfo(){
  setText('pack-title',activePack.title.toUpperCase());
  const t=activePack.track;
  setText('course-info',t.gates.length+' gates · '+t.laps+' lap'+(t.laps===1?'':'s')+(t.length?' · '+(t.length/1000).toFixed(2)+' km / lap':' · Sprint'));
  setText('pack-status',activePack.title+' · verified local data pack');
}
function applyPack(pack,recordKey,source){
  activePack=pack;activeRecordKey=recordKey;activeSource=source;audio.pause();
  if(started)reset();else{freshSession();updateHUD();}packInfo();
}
function cameraMode(){
  prefs.camera=session.camera==='fpv'?'chase':'fpv';session.camera=prefs.camera;
  if(viewButton)viewButton.textContent='View: '+(session.camera==='chase'?'Chase':'FPV');
  persist();renderer.invalidate();updateHUD();
}
function mode(){assisted=!session.assisted;setFlightMode(session,assisted);modeButton.textContent='Mode: '+(assisted?'Assisted':'Inertial');updateHUD();}
function isFormControl(target){return Boolean(target?.closest?.('input,select,textarea,button,[contenteditable]'));}
// A pointer click on a toolbar button must not trap the next flight shortcut.
function releaseButtonFocus(){const el=document.activeElement;if(el?.tagName==='BUTTON')el.blur();}
function flightAction(fn){return ()=>{fn();releaseButtonFocus();};}
document.addEventListener('focusin',e=>{if(isFormControl(e.target))clearInputs();});
document.addEventListener('keydown',e=>{
  if(isFormControl(e.target??document.activeElement))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  const actions={KeyR:reset,KeyM:mode,KeyT:cameraMode,KeyP:()=>pause(!paused),Escape:()=>pause(true),KeyB:recover};
  if(actions[e.code]){actions[e.code]();return;}keys.add(e.code);
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{clearInputs();audio.pause();pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInputs();audio.pause();pause(true);}});
document.querySelectorAll('[data-control]').forEach(b=>{
  const k=b.dataset.control;
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(k);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>touch.delete(k));
});
const on=(id,event,handler)=>q(id)?.addEventListener(event,handler);
on('restart','click',flightAction(reset));on('restart-inline','click',flightAction(reset));on('race-again','click',flightAction(reset));
on('pause','click',flightAction(()=>pause(!paused)));on('mode','click',flightAction(mode));on('view-mode','click',flightAction(cameraMode));on('recover','click',flightAction(recover));
on('pack-select','change',()=>{
  importGeneration++;const source=PRESETS[packSelect.value];
  if(source)applyPack(compilePack(source),presetRecordKey(packSelect.value),source);
});
on('pack-upload','change',async()=>{
  const input=q('pack-upload'),file=input.files?.[0],generation=++importGeneration;if(!file)return;
  try{
    if(file.size>32768)throw new RangeError('pack exceeds 32 KiB');
    const source=JSON.parse(await file.text());if(generation!==importGeneration)return;
    const pack=compilePack(source),key=await importedRecordKey(pack.id,source);
    if(generation!==importGeneration)return;
    applyPack(pack,key,source);if(packSelect)packSelect.value='custom';
  }catch(e){if(generation===importGeneration)setText('pack-status','PACK REJECTED · '+e.message);}
  finally{if(generation===importGeneration)input.value='';}
});
function download(value,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
on('pack-export','click',()=>download(activeSource,activePack.id+'.json'));
on('skin-export','click',()=>download(skinSource,skinPack.id+'.skins.json'));
on('sound-export','click',()=>download({...soundLog.export(),course:activeSource},activePack.id+'.sound-events.json'));
function skinOptions(){
  const select=q('skin-select');if(!select)return;select.replaceChildren();
  for(const s of skinPack.skins){const option=document.createElement('option');option.value=s.id;option.textContent=s.name;select.append(option);}
  select.value=skin.id;
}
function syncSkin(){
  // Keep DRONE-002's drone.color working for the original Scout appearance.
  renderer.setSkin(skinPack===BUILTIN_SKINS&&skin.id==='scout'?
    {...skin,colors:{...skin.colors,body:activePack.drone.color}}:skin);
}
function applySkin(selected){skin=selected;prefs.skin=skin.id;syncSkin();persist();updateHUD();}
on('skin-select','change',()=>{skinGeneration++;applySkin(skinPack.skins.find(s=>s.id===q('skin-select').value)??skinPack.skins[0]);});
on('skin-reset','click',()=>{skinGeneration++;skinPack=BUILTIN_SKINS;skinSource=DEFAULT_SKIN_PACK;applySkin(skinPack.skins[0]);skinOptions();setText('skin-status','Six built-in skins · cosmetics only');});
on('skin-upload','change',async()=>{
  const input=q('skin-upload'),file=input.files?.[0],generation=++skinGeneration;if(!file)return;
  try{
    if(file.size>SKIN_LIMIT)throw new RangeError('skin pack exceeds 64 KiB');
    const source=JSON.parse(await file.text());if(generation!==skinGeneration)return;
    const compiled=compileSkinPack(source);skinPack=compiled;skinSource=source;applySkin(compiled.skins[0]);skinOptions();
    setText('skin-status',compiled.title+' · '+compiled.author+' · '+compiled.skins.length+' skins');
  }catch(e){if(generation===skinGeneration)setText('skin-status','SKIN PACK REJECTED · '+e.message);}
  finally{if(generation===skinGeneration)input.value='';}
});
on('backend','change',async()=>{
  const value=q('backend').value;
  if(value==='cpu'){renderer.useCPU();return;}
  setText('backend-status','Checking WebGPU + WASM…');
  try{await renderer.enableGPU();}catch(e){setText('backend-status','CPU fallback · '+e.message);}
});
on('quality','change',()=>{prefs.quality=q('quality').value;renderer.setQuality(prefs.quality);persist();resize();});
on('sensitivity','change',()=>{prefs.sensitivity=Number(q('sensitivity').value);persist();});
on('minimap','change',()=>{prefs.minimap=q('minimap').checked;if(q('map'))q('map').hidden=!prefs.minimap;persist();});
on('sound','click',async()=>{
  releaseButtonFocus();
  if(audio.enabled){audio.disable();setText('sound','Sound: Off');return;}
  try{if(await audio.enable())setText('sound','Sound: On');}catch(e){setText('audio-status',e.message);}
});
on('volume','input',()=>{prefs.volume=Number(q('volume').value);audio.setVolume(prefs.volume);persist();});
on('music','change',()=>{prefs.music=q('music').checked;audio.music=prefs.music;audio.pause();persist();});
on('fullscreen','click',async()=>{
  releaseButtonFocus();
  try{if(document.fullscreenElement)await document.exitFullscreen();else await q('race-shell')?.requestFullscreen?.();}
  catch{notice.textContent='Fullscreen is unavailable in this browser';}
});
on('settings','toggle',()=>{if(q('settings').open)pause(true);});
function resize(){
  const scale=Math.min(globalThis.devicePixelRatio||1,QUALITY[prefs.quality].scale);
  canvas.width=Math.max(1,Math.min(1920,Math.round(canvas.clientWidth*scale)));
  canvas.height=Math.max(1,Math.min(1080,Math.round(canvas.clientHeight*scale)));renderer.invalidate();
}
new ResizeObserver(resize).observe(canvas);resize();
freshSession();pauseButton.disabled=true;skinOptions();packInfo();updateHUD();
if(packSelect)packSelect.value='neon';
for(const id of ['quality','sensitivity','volume'])if(q(id))q(id).value=String(prefs[id]);
for(const id of ['music','minimap'])if(q(id))q(id).checked=prefs[id];
if(q('map'))q('map').hidden=!prefs.minimap;
function frame(now){
  const elapsed=Math.max(0,(now-previous)/1000);previous=now;
  if(!paused)clock.advance(elapsed,()=>{
    if(paused)return;
    stepSession(session,command());soundLog.append(session);audio.update(session);
    const r=session.race;
    for(const event of session.events){
      if(event.type==='gate')notice.textContent='GATE CLEARED · '+Math.min(r.nextGate,session.track.gates.length)+'/'+session.track.gates.length;
      if(event.type==='lap')notice.textContent='LAP '+r.completedLaps+' COMPLETE · '+secondsFromTicks(r.lapTimes.at(-1))+'s';
      if(event.type==='collision')notice.textContent='CONTACT · BRAKE OR PRESS B TO RECOVER (+5s)';
    }
    if(r.status==='out-of-bounds'){
      pause(true);pauseButton.disabled=true;notice.textContent='OUT OF Q16.16 COURSE BOUNDS — PRESS R TO RESTART';
    }
    if(r.status==='finished'){
      saveBest(r.bestTicks);paused=true;clock.setPaused(true);clearInputs();pauseButton.disabled=true;
      notice.textContent='FINISHED IN '+secondsFromTicks(r.finishedTicks)+'s — PRESS R TO RESTART';
      if(q('results'))q('results').hidden=false;
      setText('result-time',secondsFromTicks(r.finishedTicks)+'s');
      setText('result-detail',r.lapTimes.map((t,i)=>'Lap '+(i+1)+': '+secondsFromTicks(t)+'s').join(' · ')+
        ' · '+r.recoveries+' recoveries · Best '+secondsFromTicks(r.bestTicks)+'s');
    }
  });
  renderer.draw(session,now);
  if(now-lastHUD>=100){updateHUD();if(prefs.minimap)drawMap(q('map'),session);lastHUD=now;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
