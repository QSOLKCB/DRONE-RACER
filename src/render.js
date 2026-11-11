// SPDX-License-Identifier: Apache-2.0
// Software Canvas representation. Simulation never reads rendering results.
import {quatConjugate,rotate} from '../engine/math/index.js';
function project(body,p,w,h){
  const local=rotate(quatConjugate(body.orientation),p.map((x,i)=>x-body.position[i]));
  if(local[2]>=-0.15)return null;
  const f=Math.min(w,h)*0.95;
  return [w/2+local[0]/-local[2]*f,h/2-local[1]/-local[2]*f,-local[2]];
}
function stroke3(ctx,body,points,w,h,color,width){
  const q=points.map(p=>project(body,p,w,h));
  if(q.some(p=>!p))return;
  ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
export function drawScene(canvas,session){
  const ctx=canvas.getContext('2d',{alpha:false}),w=canvas.width,h=canvas.height;
  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#080e1e');bg.addColorStop(1,'#102530');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const body=session.body;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  for(let z=-20;z>-360;z-=20){
    stroke3(ctx,body,[[-24,0,z],[24,0,z]],w,h,'#1a4050',1);
    for(const x of [-24,24])stroke3(ctx,body,[[x,0,z],[x,0,z-20]],w,h,'#143544',1);
  }
  for(let i=session.track.gates.length-1;i>=0;i--){
    const g=session.track.gates[i],a=g.x-g.width/2,b=g.x+g.width/2;
    const low=g.y-g.height/2,top=g.y+g.height/2;
    const active=i===session.race.nextGate;
    const color=i<session.race.nextGate?'#426475':active?'#59ffdd':'#287f9c';
    stroke3(ctx,body,[[a,low,g.z],[a,top,g.z],[b,top,g.z],[b,low,g.z],[a,low,g.z]],w,h,color,active?4:2);
    const p=project(body,[g.x,g.y,g.z],w,h);
    if(p&&p[2]<300){ctx.fillStyle=color;ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText(g.id,p[0],p[1]-8);}
  }
  ctx.strokeStyle='#77e9d1';ctx.lineWidth=1.5;ctx.beginPath();
  ctx.arc(w/2,h/2,15,0,Math.PI*2);
  ctx.moveTo(w/2-28,h/2);ctx.lineTo(w/2-20,h/2);
  ctx.moveTo(w/2+20,h/2);ctx.lineTo(w/2+28,h/2);ctx.stroke();ctx.restore();
  const vig=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.75);
  vig.addColorStop(0,'#00000000');vig.addColorStop(1,'#00000090');
  ctx.fillStyle=vig;ctx.fillRect(0,0,w,h);
}
