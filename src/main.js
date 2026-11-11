// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../engine/time/index.js';
import {createSession,setFlightMode,stepSession,secondsFromTicks,STEP} from './game.js';
import {drawScene} from './render.js';
import {compilePack,DEFAULT_PACK,SPECTRUM_PACK} from './mods.js';
const canvas=document.querySelector('#flight'),hud=document.querySelector('#hud'),notice=document.querySelector('#notice');
const startButton=document.querySelector('#restart'),pauseButton=document.querySelector('#pause');
const modeButton=document.querySelector('#mode'),overlay=document.querySelector('#overlay');
const keys=new Set(),touch=new Set(),clock=new FixedClock({step:STEP,maxFrame:.12,maxSteps:6});
const KEY='qsol.drone-racer.independence-sprint.v1.bestTicks';
let session,started=false,paused=true,previous=performance.now(),lastGate=0;
let activePack=compilePack(DEFAULT_PACK),importGeneration=0;
const packSelect=document.querySelector('#pack-select');
const packUpload=document.querySelector('#pack-upload');
const packStatus=document.querySelector('#pack-status');
const viewButton=document.querySelector('#view-mode');
function bestKey(){
  return activePack.id==='independence-sprint'?KEY:
    'qsol.drone-racer.pack.'+activePack.id+'.v1.bestTicks';
}
function best(){
  try{const raw=localStorage.getItem(bestKey());if(raw===null)return null;
    const n=Number(raw);return Number.isSafeInteger(n)&&n>0?n:null;
  }catch{return null;}
}
function saveBest(n){try{localStorage.setItem(bestKey(),String(n));}catch{}}
function clearInputs(){keys.clear();touch.clear();}
function updateHUD(){
  if(!session)return;const r=session.race;
  hud.textContent='GATE '+Math.min(r.nextGate+1,session.track.gates.length)+'/'+session.track.gates.length+
    ' · '+secondsFromTicks(r.ticks)+'s · '+Math.hypot(...session.body.velocity).toFixed(1)+' m/s'+
    ' · '+(session.assisted?'ASSISTED':'INERTIAL')+
    ' · '+session.droneName+' · '+(session.camera==='chase'?'CHASE':'FPV')+
    ' · BEST '+(secondsFromTicks(r.bestTicks)??'--')+'s';
}
function pause(on){
  // The start overlay is an explicit race gate, not a paused running session.
  // A pre-start click/key/blur cannot resume simulation behind the overlay.
  if(!started||(!on&&session.race.status==='finished'))return;
  paused=Boolean(on);clock.setPaused(paused);clearInputs();
  // requestAnimationFrame may be suspended for minutes while the page is
  // backgrounded. The first post-resume frame must not consume that interval.
  if(!paused)previous=performance.now();
  if(paused)notice.textContent='PAUSED — PRESS RESUME';
  else notice.textContent=lastGate
    ? 'GATE CLEARED · '+lastGate+'/'+session.track.gates.length
    : 'FLY THROUGH EACH GATE IN ORDER';
  pauseButton.textContent=paused?'Resume':'Pause';updateHUD();
}
function reset(){
  session=createSession(activePack.track,best(),activePack.drone);
  session.accent=activePack.accent;clock.reset();clock.setPaused(false);
  started=true;paused=false;clearInputs();lastGate=0;overlay.hidden=true;
  modeButton.textContent='Mode: Assisted';pauseButton.textContent='Pause';
  if(viewButton)viewButton.textContent='View: FPV';
  pauseButton.disabled=false;
  notice.textContent='FLY THROUGH EACH GATE IN ORDER';previous=performance.now();updateHUD();
}
function down(k){return keys.has(k)||touch.has(k);}
function axis(p,n){return Number(down(p))-Number(down(n));}
function command(){
  return {thrust:[axis('KeyD','KeyA'),axis('KeyE','KeyQ'),axis('KeyS','KeyW')],
    turn:[axis('ArrowDown','ArrowUp'),axis('ArrowLeft','ArrowRight'),axis('KeyC','KeyV')],
    brake:down('Space')};
}
function applyPack(pack){
  activePack=pack;
  if(packStatus)packStatus.textContent=pack.title+' · verified local data pack';
  if(started)reset();
  else{
    session=createSession(activePack.track,best(),activePack.drone);
    session.accent=activePack.accent;updateHUD();
  }
  const title=document.querySelector('#pack-title');
  if(title)title.textContent=pack.title.toUpperCase();
}
function cameraMode(){
  if(!session)return;
  session.camera=session.camera==='fpv'?'chase':'fpv';
  if(viewButton)viewButton.textContent='View: '+(session.camera==='chase'?'Chase':'FPV');
  updateHUD();
}
function mode(){
  setFlightMode(session,!session.assisted);
  modeButton.textContent='Mode: '+(session.assisted?'Assisted':'Inertial');updateHUD();
}
document.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='KeyR'){reset();return;}
  if(e.code==='KeyM'){mode();return;}
  if(e.code==='KeyT'){cameraMode();return;}
  if(e.code==='KeyP'){pause(!paused);return;}
  keys.add(e.code);
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>pause(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
document.querySelectorAll('[data-control]').forEach(b=>{
  const k=b.dataset.control;
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(k);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])
    b.addEventListener(ev,()=>touch.delete(k));
});
startButton.addEventListener('click',reset);
document.querySelector('#restart-inline').addEventListener('click',reset);
pauseButton.addEventListener('click',()=>pause(!paused));
modeButton.addEventListener('click',mode);
if(viewButton)viewButton.addEventListener('click',cameraMode);
if(packSelect)packSelect.addEventListener('change',()=>{
  importGeneration++;
  if(packSelect.value==='default')applyPack(compilePack(DEFAULT_PACK));
  else if(packSelect.value==='spectrum')applyPack(compilePack(SPECTRUM_PACK));
});
if(packUpload)packUpload.addEventListener('change',async()=>{
  const file=packUpload.files?.[0],generation=++importGeneration;
  if(!file)return;
  try{
    if(file.size>32768)throw new RangeError('pack exceeds 32 KiB');
    const source=JSON.parse(await file.text());
    if(generation!==importGeneration)return;
    const pack=compilePack(source);
    applyPack(pack);
    if(packSelect)packSelect.value='custom';
  }catch(error){
    if(generation===importGeneration&&packStatus)
      packStatus.textContent='PACK REJECTED · '+error.message;
  }finally{packUpload.value='';}
});
const packExport=document.querySelector('#pack-export');
if(packExport)packExport.addEventListener('click',()=>{
  const source=packSelect?.value==='spectrum'?SPECTRUM_PACK:DEFAULT_PACK;
  const url=URL.createObjectURL(new Blob([JSON.stringify(source,null,2)+'\n'],
    {type:'application/json'}));
  const a=document.createElement('a');
  a.href=url;a.download=source.id+'.json';a.click();URL.revokeObjectURL(url);
});
function resize(){
  const scale=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.max(1,Math.min(1600,Math.round(canvas.clientWidth*scale)));
  canvas.height=Math.max(1,Math.min(1000,Math.round(canvas.clientHeight*scale)));
}
new ResizeObserver(resize).observe(canvas);resize();
session=createSession(activePack.track,best(),activePack.drone);
session.accent=activePack.accent;pauseButton.disabled=true;updateHUD();
function frame(now){
  const elapsed=Math.max(0,(now-previous)/1000);previous=now;
  if(!paused)clock.advance(elapsed,()=>{
    stepSession(session,command());
    const r=session.race;
    if(r.nextGate!==lastGate){lastGate=r.nextGate;notice.textContent='GATE CLEARED · '+r.nextGate+'/'+session.track.gates.length;}
    if(r.status==='out-of-bounds'){
      pause(true);pauseButton.disabled=true;
      notice.textContent='OUT OF Q16.16 COURSE BOUNDS — PRESS R TO RESTART';
    }
    if(r.status==='finished'){
      saveBest(r.bestTicks);pause(true);pauseButton.disabled=true;
      notice.textContent='FINISHED IN '+secondsFromTicks(r.finishedTicks)+'s — PRESS R TO RESTART';
    }
  });
  drawScene(canvas,session);updateHUD();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
