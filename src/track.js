// SPDX-License-Identifier: Apache-2.0
// Source-independent, ordered swept course checkpoints.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const TRACK=Object.freeze({id:'independence-sprint',version:1,title:'Independence Sprint',
  gates:Object.freeze([
    {id:'01',x:0,y:3,z:-28,width:14,height:9},
    {id:'02',x:-3,y:3.5,z:-75,width:13,height:9},
    {id:'03',x:4,y:4,z:-124,width:13,height:9},
    {id:'04',x:0,y:3,z:-175,width:12,height:8},
    {id:'05',x:-4,y:3.5,z:-225,width:12,height:8},
    {id:'06',x:0,y:3,z:-285,width:14,height:9}
  ].map(g=>Object.freeze(g)))});
export function validateTrack(track){
  if(!track||typeof track!=='object'||!/^[a-z][a-z0-9-]{0,47}$/.test(track.id||'')||
     !Number.isSafeInteger(track.version)||track.version<1||!Array.isArray(track.gates)||
     track.gates.length<2||track.gates.length>64)throw new TypeError('invalid track');
  let previousZ=0;const seen=new Set();
  for(const g of track.gates){
    if(!g||typeof g.id!=='string'||!/^[a-zA-Z0-9-]{1,32}$/.test(g.id)||
       seen.has(g.id)||!['x','y','z','width','height'].every(k=>finite(g[k]))||
       g.width<2||g.width>100||g.height<2||g.height>100||g.z>=previousZ-4||
       Math.abs(g.x)>200||g.y<0||g.y>200)throw new RangeError('invalid gate');
    seen.add(g.id);previousZ=g.z;
  }
  return track;
}
export function gateCrossing(from,to,gate,margin=0.35){
  if(!Array.isArray(from)||!Array.isArray(to)||from.length!==3||to.length!==3||
     !from.every(finite)||!to.every(finite)||!finite(margin)||margin<0||
     margin*2>=Math.min(gate.width,gate.height))throw new TypeError('invalid sweep');
  if(!(from[2]>gate.z&&to[2]<=gate.z))return null;
  const fraction=(from[2]-gate.z)/(from[2]-to[2]);
  const x=from[0]+(to[0]-from[0])*fraction,y=from[1]+(to[1]-from[1])*fraction;
  if(Math.abs(x-gate.x)>gate.width/2-margin||Math.abs(y-gate.y)>gate.height/2-margin)return null;
  return Object.freeze({fraction,x,y});
}
export function newRace(bestTicks=null){
  if(bestTicks!==null&&(!Number.isSafeInteger(bestTicks)||bestTicks<=0))
    throw new RangeError('invalid best time');
  return {status:'running',ticks:0,nextGate:0,finishedTicks:null,bestTicks};
}
export function advanceRace(race,from,to,track=TRACK){
  validateTrack(track);
  if(race.status!=='running')return {...race};
  const next={...race,ticks:race.ticks+1};
  // A fast flight step can cross multiple consecutive gates. Their z planes
  // are strictly ordered, so consume each eligible crossing on this one sweep.
  // Stop at the first missed gate: a later gate must never skip an earlier one.
  while(next.nextGate<track.gates.length&&
        gateCrossing(from,to,track.gates[next.nextGate])){
    next.nextGate++;
  }
  if(next.nextGate===track.gates.length){
    next.status='finished';next.finishedTicks=next.ticks;
    next.bestTicks=next.bestTicks===null?next.ticks:Math.min(next.bestTicks,next.ticks);
  }
  return next;
}
validateTrack(TRACK);
