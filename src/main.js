// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../engine/time/index.js';
import {createSession,setFlightMode,stepSession,secondsFromTicks,STEP} from './game.js';
import {drawScene} from './render.js';
const canvas=document.querySelector('#flight'),hud=document.querySelector('#hud'),notice=document.querySelector('#notice');
const startButton=document.querySelector('#restart'),pauseButton=document.querySelector('#pause');
const modeButton=document.querySelector('#mode'),overlay=document.querySelector('#overlay');
const keys=new Set(),touch=new Set(),clock=new FixedClock({step:STEP,maxFrame:.12,maxSteps:6});
const KEY='qsol.drone-racer.independence-sprint.v1.bestTicks';
let session,paused=true,previous=performance.now(),lastGate=0;
function best(){
  try{const raw=localStorage.getItem(KEY);if(raw===null)return null;
    const n=Number(raw);return Number.isSafeInteger(n)&&n>0?n:null;
  }catch{return null;}
}
function saveBest(n){try{localStorage.setItem(KEY,String(n));}catch{}}
function clearInputs(){keys.clear();touch.clear();}
function updateHUD(){
  if(!session)return;const r=session.race;
  hud.textContent='GATE '+Math.min(r.nextGate+1,session.track.gates.length)+'/'+session.track.gates.length+
    ' · '+secondsFromTicks(r.ticks)+'s · '+Math.hypot(...session.body.velocity).toFixed(1)+' m/s'+
    ' · '+(session.assisted?'ASSISTED':'INERTIAL')+
    ' · BEST '+(secondsFromTicks(r.bestTicks)??'--')+'s';
}
function pause(on){
  paused=Boolean(on);clock.setPaused(paused);clearInputs();
  if(paused)notice.textContent='PAUSED — PRESS RESUME';
  else notice.textContent=lastGate
    ? 'GATE CLEARED · '+lastGate+'/'+session.track.gates.length
    : 'FLY THROUGH EACH GATE IN ORDER';
  pauseButton.textContent=paused?'Resume':'Pause';updateHUD();
}
function reset(){
  session=createSession(undefined,best());clock.reset();clock.setPaused(false);
  paused=false;clearInputs();lastGate=0;overlay.hidden=true;
  modeButton.textContent='Mode: Assisted';pauseButton.textContent='Pause';
  notice.textContent='FLY THROUGH EACH GATE IN ORDER';previous=performance.now();updateHUD();
}
function down(k){return keys.has(k)||touch.has(k);}
function axis(p,n){return Number(down(p))-Number(down(n));}
function command(){
  return {thrust:[axis('KeyD','KeyA'),axis('KeyE','KeyQ'),axis('KeyS','KeyW')],
    turn:[axis('ArrowDown','ArrowUp'),axis('ArrowLeft','ArrowRight'),axis('KeyC','KeyV')],
    brake:down('Space')};
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
function resize(){
  const scale=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.max(1,Math.min(1600,Math.round(canvas.clientWidth*scale)));
  canvas.height=Math.max(1,Math.min(1000,Math.round(canvas.clientHeight*scale)));
}
new ResizeObserver(resize).observe(canvas);resize();
session=createSession(undefined,best());updateHUD();
function frame(now){
  const elapsed=Math.max(0,(now-previous)/1000);previous=now;
  if(!paused)clock.advance(elapsed,()=>{
    stepSession(session,command());
    const r=session.race;
    if(r.nextGate!==lastGate){lastGate=r.nextGate;notice.textContent='GATE CLEARED · '+r.nextGate+'/'+session.track.gates.length;}
    if(r.status==='finished'){
      saveBest(r.bestTicks);pause(true);
      notice.textContent='FINISHED IN '+secondsFromTicks(r.finishedTicks)+'s — PRESS R TO RESTART';
    }
  });
  drawScene(canvas,session);updateHUD();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
