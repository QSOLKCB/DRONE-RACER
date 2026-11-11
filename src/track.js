// SPDX-License-Identifier: Apache-2.0
// DRONE-002: exact authored gate geometry and explicit Float64 -> Q16.16
// checkpoint admission. Rendering is a separate floating-point projection.
import {compileCourseQ16,advanceCourseQ16} from '../engine/exact-course/index.js';
import {SCALE} from '../engine/integer-math/index.js';
import {pointToRawQ16} from './position-q16.js';
import {compileCircuit,advanceCircuit} from './circuit.js';
const admitted=new WeakMap();
export const TRACK_SOURCE=Object.freeze({
  id:'independence-sprint',version:1,
  gates:Object.freeze([
    {id:'01',x:'0',y:'3',z:'-28',width:'14',height:'9'},
    {id:'02',x:'-3',y:'3.5',z:'-75',width:'13',height:'9'},
    {id:'03',x:'4',y:'4',z:'-124',width:'13',height:'9'},
    {id:'04',x:'0',y:'3',z:'-175',width:'12',height:'8'},
    {id:'05',x:'-4',y:'3.5',z:'-225',width:'12',height:'8'},
    {id:'06',x:'0',y:'3',z:'-285',width:'14',height:'9'}
  ].map(g=>Object.freeze(g)))
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function validateTrack(track){
  if(!admitted.has(track))throw new TypeError('compiled race track required');
  return track;
}
/** A source record is never trusted as compiled data. Compile first. */
export function compileRaceTrack(authoring,title='Custom Course'){
  if(typeof title!=='string'||title.length<1||title.length>80)
    throw new TypeError('bounded track title required');
  // Inspect the descriptor without executing a source-owned getter.
  if(Object.getOwnPropertyDescriptor(authoring??{},'version')?.value===2){
    const track=compileCircuit(authoring,title);admitted.set(track,null);return track;
  }
  const c=compileCourseQ16(authoring,{rounding:'exact',overflow:'reject'});
  const gates=Object.freeze(c.gates.map(g=>Object.freeze({
    id:g.id,x:(g.leftRaw+g.rightRaw)/(2*SCALE),
    y:(g.bottomRaw+g.topRaw)/(2*SCALE),
    z:g.zRaw/SCALE,
    width:(g.rightRaw-g.leftRaw)/SCALE,
    height:(g.topRaw-g.bottomRaw)/SCALE
  })));
  const track=Object.freeze({id:c.id,version:c.version,title,gates,laps:1,
    spawn:Object.freeze([0,3,5]),obstacles:Object.freeze([]),boxes:Object.freeze([])});
  admitted.set(track,c);
  return track;
}
export const TRACK=compileRaceTrack(TRACK_SOURCE,'Independence Sprint');
/** Original 001 helper retained for compatibility, not the race authority. */
export function gateCrossing(from,to,gate,margin=0.35){
  if(!Array.isArray(from)||!Array.isArray(to)||from.length!==3||to.length!==3||
    !from.every(finite)||!to.every(finite)||!finite(margin)||margin<0||
    margin*2>=Math.min(gate.width,gate.height))throw new TypeError('invalid sweep');
  if(!(from[2]>gate.z&&to[2]<=gate.z))return null;
  const fraction=(from[2]-gate.z)/(from[2]-to[2]);
  const x=from[0]+(to[0]-from[0])*fraction;
  const y=from[1]+(to[1]-from[1])*fraction;
  if(Math.abs(x-gate.x)>gate.width/2-margin||
     Math.abs(y-gate.y)>gate.height/2-margin)return null;
  return Object.freeze({fraction,x,y});
}
export function newRace(bestTicks=null){
  if(bestTicks!==null&&(!Number.isSafeInteger(bestTicks)||bestTicks<=0))
    throw new RangeError('invalid best time');
  return {status:'running',ticks:0,nextGate:0,finishedTicks:null,bestTicks,
    completedLaps:0,lapStartedTicks:0,lapTimes:[],clearedGates:0,penaltyTicks:0,recoveries:0,tickEvents:[]};
}
/** Authoritative ordered gate adjudication over deliberately quantized flight poses. */
export function advanceRace(race,from,to,track=TRACK){
  const compiled=admitted.get(validateTrack(track));
  if(race.status!=='running')return {...race};
  if(!Number.isSafeInteger(race.ticks)||race.ticks<0||
    !Number.isSafeInteger(race.nextGate)||race.nextGate<0||race.nextGate>=track.gates.length)
    throw new TypeError('invalid race state');
  const result=track.version===2?advanceCircuit(race,from,to,track):
    advanceCourseQ16(compiled,race.nextGate,pointToRawQ16(from),pointToRawQ16(to));
  const next={...race,ticks:race.ticks+1,nextGate:result.nextGate,
    clearedGates:race.clearedGates+result.crossed};
  const events=result.events??Array.from({length:result.crossed},(_,i)=>({type:'gate',index:race.clearedGates+i+1}));
  if(track.version===1&&result.finished)events.push({type:'finish',index:1});
  next.tickEvents=events.map(e=>({...e,tick:next.ticks}));
  if(result.lapCompleted||result.finished){
    next.completedLaps++;
    next.lapTimes=[...race.lapTimes,next.ticks-race.lapStartedTicks];
    next.lapStartedTicks=next.ticks;
    if(result.finished){
      next.status='finished';next.finishedTicks=next.ticks;
      next.bestTicks=next.bestTicks===null?next.ticks:Math.min(next.bestTicks,next.ticks);
    }
  }
  return next;
}
