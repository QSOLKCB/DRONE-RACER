// SPDX-License-Identifier: Apache-2.0
// Game-specific retained geometry over the pinned VANILLAJS optional renderer.
import {DepthRenderer} from './depth-renderer.js';
import {rotate,perspective,viewMatrix,multiplyMatrices} from '../engine/math/index.js';
import {BUILTIN_SKINS} from './skins.js';
export const QUALITY=Object.freeze({
  eco:{scale:1,distance:260,fps:30,scenery:false},
  balanced:{scale:1.25,distance:550,fps:60,scenery:true},
  high:{scale:1.75,distance:1000,fps:60,scenery:true}
});
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const vertex=(out,p,c)=>out.push(...p,...c);
const triangle=(out,a,b,c,color)=>{vertex(out,a,color);vertex(out,b,color);vertex(out,c,color);};
function line(out,a,b,color){vertex(out,a,rgb(color));vertex(out,b,rgb(color));}
export function boxGeometry(out,center,size,color,transform=p=>p){
  const corners=Array.from({length:8},(_,i)=>transform(center.map((n,k)=>n+size[k]*(i&(1<<k)?.5:-.5))));
  const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
  for(let i=0;i<faces.length;i++){
    const [a,b,c,d]=faces[i].map(j=>corners[j]),shade=[.52,.7,.45,1,.62,.8][i];
    const tint=rgb(color).map(n=>n*shade);triangle(out,a,b,c,tint);triangle(out,a,c,d,tint);
  }
}
function gateGeometry(g,color){
  const out=[],a=g.axis==='x'?0:2,u=a===0?2:0,center=[g.x,g.y,g.z];
  for(const sign of [-1,1]){
    const side=[...center],top=[...center],sideSize=[.8,g.height+1.2,.8],topSize=[.8,.6,.8];
    side[u]+=sign*(g.width/2+.3);sideSize[u]=.6;
    top[1]+=sign*(g.height/2+.3);topSize[u]=g.width;
    boxGeometry(out,side,sideSize,color);boxGeometry(out,top,topSize,color);
  }
  // Lit feet make gate orientation and distance readable without labels.
  return out;
}
export function droneGeometry(skin,body,tick=0){
  const out=[],toWorld=p=>rotate(body.orientation,p).map((n,i)=>n+body.position[i]);
  for(const p of skin.parts)boxGeometry(out,p.position,p.size,skin.colors[p.color],toWorld);
  for(const r of skin.rotors){
    boxGeometry(out,r.position,[.14,.12,.14],skin.colors.body,toWorld);
    for(let blade=0;blade<r.blades;blade++){
      const angle=tick*.7+blade*Math.PI*2/r.blades;
      const point=(radius,offset)=>toWorld([r.position[0]+Math.cos(angle+offset)*radius,r.position[1]+.08,r.position[2]+Math.sin(angle+offset)*radius]);
      triangle(out,point(.04,-.4),point(r.radius,-.17),point(r.radius,.17),rgb(skin.colors.rotor));
    }
  }
  return out;
}
export function cameraMatrix(session,aspect,distance){
  const body=session.body,offset=session.camera==='chase'?rotate(body.orientation,[0,1.5,6]):[0,0,0];
  const eye=body.position.map((n,i)=>n+offset[i]),bounds=session.track.bounds;
  // Pitching at ground contact can put the chase eye below the solid floor.
  // Keep the entire near plane above it without changing the flight pose.
  const clearance=.15*Math.hypot(1,Math.tan(Math.PI/5),Math.tan(Math.PI/5)*aspect)+.01;
  if(eye[0]>=bounds.min[0]-clearance&&eye[0]<=bounds.max[0]+clearance&&
     eye[2]>=bounds.min[2]-clearance&&eye[2]<=bounds.max[2]+clearance)
    eye[1]=Math.max(eye[1],bounds.max[1]+clearance);
  return multiplyMatrices(perspective(Math.PI/2.5,aspect,.15,distance),
    viewMatrix(eye,body.orientation));
}
export class RaceRenderer{
  constructor(canvas,{onMode=()=>{}}={}){
    this.canvas=canvas;this.renderer=new DepthRenderer(canvas,{onMode});this.track=null;this.quality='balanced';
    this.key='';this.revision=0;this.lastDraw=-Infinity;this.items=[];this.skin=BUILTIN_SKINS.skins[0];
  }
  invalidate(){this.revision++;this.key='';}
  setQuality(value){if(!Object.hasOwn(QUALITY,value))throw new TypeError('unknown quality');this.quality=value;this.invalidate();}
  setSkin(skin){this.skin=skin;this.invalidate();}
  async enableGPU(){const enabled=await this.renderer.enableGPU();this.invalidate();return enabled;}
  useCPU(){this.renderer.useCPU();this.invalidate();}
  setTrack(track,accent){
    for(const item of [...this.renderer.meshes.keys()])this.renderer.deleteMesh(item);
    this.track=track;this.accent=accent;this.items=[];this.gates=[];this.lastGate=-1;
    const add=(data,mode='triangles',position=null,scenery=false)=>{
      const handle=this.renderer.createMesh(data,mode);this.items.push({handle,position,scenery});return handle;
    };
    const {min,max}=track.bounds,[minX,,minZ]=min,[maxX,,maxZ]=max;
    const floor=[];
    boxGeometry(floor,min.map((n,i)=>(n+max[i])/2),max.map((n,i)=>n-min[i]),'#122635');
    add(floor);
    const grid=[];
    for(let x=Math.ceil(minX/40)*40;x<maxX;x+=40)line(grid,[x,.02,minZ],[x,.02,maxZ],'#234354');
    for(let z=Math.ceil(minZ/40)*40;z<maxZ;z+=40)line(grid,[minX,.02,z],[maxX,.02,z],'#234354');
    const path=track.version===2?[track.gates.at(-1),...track.gates]:[{x:0,z:5},...track.gates];
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];line(grid,[a.x,.05,a.z],[b.x,.05,b.z],'#2e9c9b');
      const length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.min(96,Math.ceil(length/14));
      for(let j=1;j<steps;j++){
        const x=a.x+(b.x-a.x)*j/steps,z=a.z+(b.z-a.z)*j/steps;
        const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
        line(grid,[x-dx*2-dz*1.6,.08,z-dz*2+dx*1.6],[x,.08,z],'#4abbb1');
        line(grid,[x-dx*2+dz*1.6,.08,z-dz*2-dx*1.6],[x,.08,z],'#4abbb1');
      }
    }
    add(grid,'lines');
    for(const g of track.gates)this.gates.push(add(gateGeometry(g,'#237383'),'triangles',[g.x,g.y,g.z]));
    const obstacles=[];
    for(const o of track.obstacles){
      const center=o.min.map((n,i)=>(n+o.max[i])/2),size=o.max.map((n,i)=>n-o.min[i]);
      boxGeometry(obstacles,center,size,o.color);
      boxGeometry(obstacles,[center[0],o.max[1]+.04,center[2]],[size[0]+.08,.08,size[2]+.08],'#ffe0a3');
    }
    add(obstacles);
    const skyline=[];
    for(let i=0;i<36;i++){
      const x=i%2?minX-20:maxX+20,z=minZ+(maxZ-minZ)*(i/35),height=12+(i*17%41);
      boxGeometry(skyline,[x,height/2,z],[10,height,14],'#1b354c');
      boxGeometry(skyline,[x,height+.2,z],[10,.4,14],i%3?'#275a76':accent);
    }
    add(skyline,'triangles',null,true);
    this.drone=this.renderer.createMesh([]);this.invalidate();
  }
  draw(session,now=0){
    const quality=QUALITY[this.quality];
    if(this.track!==session.track||this.accent!==session.accent)this.setTrack(session.track,session.accent);
    const key=[session.race.ticks,session.race.nextGate,session.camera,this.revision,this.canvas.width,this.canvas.height,this.renderer.mode].join(':');
    if(this.key===key||now-this.lastDraw<1000/quality.fps-1)return false;
    this.lastDraw=now;
    if(this.lastGate!==session.race.nextGate){
      for(let i=0;i<this.gates.length;i++)this.renderer.updateMesh(this.gates[i],gateGeometry(session.track.gates[i],
        i===session.race.nextGate?session.accent:i<session.race.nextGate?'#305268':'#237383'));
      this.lastGate=session.race.nextGate;
    }
    const vp=cameraMatrix(session,this.canvas.width/this.canvas.height,quality.distance+100);
    this.renderer.beginFrame({vp,fog:.0012});
    for(const item of this.items){
      if(item.scenery&&!quality.scenery)continue;
      if(item.position&&Math.hypot(...item.position.map((n,i)=>n-session.body.position[i]))>quality.distance)continue;
      this.renderer.draw(item.handle);
    }
    if(session.camera==='chase'){
      this.renderer.updateMesh(this.drone,droneGeometry(this.skin,session.body,session.race.ticks));this.renderer.draw(this.drone);
    }
    this.renderer.endFrame();this.key=key;return true;
  }
  stats(){return this.renderer.stats();}
  dispose(){this.renderer.dispose();}
}
export function drawMap(canvas,session){
  if(!canvas)return;
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,gates=session.track.gates;
  const xs=gates.map(g=>g.x),zs=gates.map(g=>g.z),minX=Math.min(...xs)-30,minZ=Math.min(...zs)-30;
  const scale=Math.min((w-20)/(Math.max(...xs)-minX+30),(h-20)/(Math.max(...zs)-minZ+30));
  const point=(x,z)=>[10+(x-minX)*scale,10+(z-minZ)*scale];
  ctx.clearRect(0,0,w,h);ctx.lineWidth=2;ctx.strokeStyle='#426674';ctx.beginPath();
  gates.forEach((g,i)=>{const p=point(g.x,g.z);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});
  if(session.track.version===2)ctx.closePath();ctx.stroke();
  for(let i=0;i<gates.length;i++){
    const p=point(gates[i].x,gates[i].z);ctx.fillStyle=i===session.race.nextGate?session.accent:'#587480';ctx.fillRect(p[0]-2,p[1]-2,4,4);
  }
  const [x,y]=point(session.body.position[0],session.body.position[2]),f=rotate(session.body.orientation,[0,0,-1]);
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+f[0]*10,y+f[2]*10);ctx.stroke();
}
