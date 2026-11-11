// SPDX-License-Identifier: Apache-2.0
// Software Canvas representation. Simulation never reads rendering results.
import {quatConjugate,rotate} from '../engine/math/index.js';
const NEAR=-0.150000001;
function cameraPoint(body,p){
  return rotate(quatConjugate(body.orientation),p.map((x,i)=>x-body.position[i]));
}
function screenPoint(p,w,h){
  const f=Math.min(w,h)*0.95;
  return [w/2+p[0]/-p[2]*f,h/2-p[1]/-p[2]*f,-p[2]];
}
function project(body,p,w,h){
  const local=cameraPoint(body,p);
  return local[2]>=-0.15?null:screenPoint(local,w,h);
}
function clipNear(a,b){
  const frontA=a[2]<=NEAR,frontB=b[2]<=NEAR;
  if(!frontA&&!frontB)return null;
  if(frontA&&frontB)return [a,b];
  // Keep the forward portion of each independent line segment, instead of
  // removing the whole gate frame when a different corner is behind camera.
  const t=(NEAR-a[2])/(b[2]-a[2]);
  const intersection=a.map((v,i)=>v+(b[i]-v)*t);
  return frontA?[a,intersection]:[intersection,b];
}
// Clip the projected segment to the visible canvas viewport. Near-plane
// clipping can leave both endpoints off-screen while the line itself crosses
// the viewport; endpoint-only visibility checks would discard that edge.
function clipViewport(a,b,w,h){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  let lo=0,hi=1;
  for(const [p,q] of [[-dx,a[0]],[dx,w-a[0]],[-dy,a[1]],[dy,h-a[1]]]){
    if(p===0){if(q<0)return null;continue;}
    const t=q/p;
    if(p<0){if(t>hi)return null;lo=Math.max(lo,t);}
    else {if(t<lo)return null;hi=Math.min(hi,t);}
  }
  if(lo>hi)return null;
  return [[a[0]+dx*lo,a[1]+dy*lo],[a[0]+dx*hi,a[1]+dy*hi]];
}
function stroke3(ctx,body,points,w,h,color,width){
  const camera=points.map(p=>cameraPoint(body,p));
  for(let i=1;i<camera.length;i++){
    const clipped=clipNear(camera[i-1],camera[i]);
    if(!clipped)continue;
    const a=screenPoint(clipped[0],w,h),b=screenPoint(clipped[1],w,h);
    const visible=clipViewport(a,b,w,h);
    if(!visible)continue;
    ctx.beginPath();ctx.moveTo(...visible[0]);ctx.lineTo(...visible[1]);
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
}
export function drawScene(canvas,session){
  const ctx=canvas.getContext('2d',{alpha:false}),w=canvas.width,h=canvas.height;
  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#080e1e');bg.addColorStop(1,'#102530');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const body=session.body;
  const chase=session.camera==='chase';
  const offset=chase?rotate(body.orientation,[0,1.5,6]):[0,0,0];
  const eye=chase?{
    position:body.position.map((v,i)=>v+offset[i]),
    orientation:body.orientation
  }:body;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  for(let z=-20;z>-360;z-=20){
    stroke3(ctx,eye,[[-24,0,z],[24,0,z]],w,h,'#1a4050',1);
    for(const x of [-24,24])stroke3(ctx,eye,[[x,0,z],[x,0,z-20]],w,h,'#143544',1);
  }
  for(let i=session.track.gates.length-1;i>=0;i--){
    const g=session.track.gates[i],a=g.x-g.width/2,b=g.x+g.width/2;
    const low=g.y-g.height/2,top=g.y+g.height/2;
    const active=i===session.race.nextGate;
    const color=i<session.race.nextGate?'#426475':active?(session.accent??'#59ffdd'):'#287f9c';
    stroke3(ctx,eye,[[a,low,g.z],[a,top,g.z],[b,top,g.z],[b,low,g.z],[a,low,g.z]],w,h,color,active?4:2);
    const p=project(eye,[g.x,g.y,g.z],w,h);
    if(p&&p[2]<300){ctx.fillStyle=color;ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText(g.id,p[0],p[1]-8);}
  }
  if(chase){
    // First-person simulation unchanged; draw a small drone silhouette from
    // its pose only. Camera rendering is not part of checkpoint authority.
    const toWorld=p=>rotate(body.orientation,p).map((v,i)=>v+body.position[i]);
    for(const path of [
      [[-0.8,0,-0.65],[0,0,0],[0.8,0,-0.65]],
      [[-0.8,0,0.65],[0,0,0],[0.8,0,0.65]],
      [[0,0,-0.65],[0,0,0.65]]
    ])stroke3(ctx,eye,path.map(toWorld),w,h,session.droneColor??'#a8ffdf',5);
    for(const x of [-0.8,0.8])for(const z of [-0.65,0.65]){
      const points=Array.from({length:13},(_,i)=>{
        const theta=i*Math.PI/6;
        return toWorld([x+0.3*Math.cos(theta),0,z+0.3*Math.sin(theta)]);
      });
      stroke3(ctx,eye,points,w,h,session.accent??'#59ffdd',2);
    }
  }
  ctx.strokeStyle='#77e9d1';ctx.lineWidth=1.5;ctx.beginPath();
  ctx.arc(w/2,h/2,15,0,Math.PI*2);
  ctx.moveTo(w/2-28,h/2);ctx.lineTo(w/2-20,h/2);
  ctx.moveTo(w/2+20,h/2);ctx.lineTo(w/2+28,h/2);ctx.stroke();ctx.restore();
  const vig=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.75);
  vig.addColorStop(0,'#00000000');vig.addColorStop(1,'#00000090');
  ctx.fillStyle=vig;ctx.fillRect(0,0,w,h);
}
