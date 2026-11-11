// SPDX-License-Identifier: Apache-2.0
import {createBody,flightConfig,stepFlight} from '../engine/flight/index.js';
import {newRace,advanceRace,TRACK,validateTrack} from './track.js';
export const STEP=1/60;
export function createSession(track=TRACK,bestTicks=null,drone=null){
  validateTrack(track);
  return {track,body:createBody({position:track.spawn,halfSize:drone?.halfSize??0.35,mass:drone?.mass??1}),
    droneName:drone?.name??'Independence Scout',droneColor:drone?.color??'#b7f9ee',
    camera:'fpv',accent:'#59ffdd',assisted:true,
    config:flightConfig({assisted:true,acceleration:drone?.acceleration??36,
      maxSpeed:drone?.maxSpeed??46,response:drone?.response??2.8,
      angularAcceleration:drone?.angularAcceleration??4,turnSpeed:drone?.turnSpeed??2,
      angularResponse:drone?.angularResponse??6,brake:drone?.brake??5}),
    race:newRace(bestTicks),lastPosition:[...track.spawn],recoveryPosition:[...track.spawn],
    collisions:0,lastCollisionTick:-60,events:[]};
}
export function setFlightMode(session,assisted){
  session.assisted=Boolean(assisted);
  session.config=flightConfig({...session.config,assisted:session.assisted});
}
export function stepSession(session,command,dt=STEP){
  if(!Number.isFinite(dt)||dt<=0||dt>0.05)throw new RangeError('invalid step');
  if(session.race.status!=='running')return {contacts:[],truncated:false};
  session.events=[];
  const before=[...session.body.position];
  const result=stepFlight(session.body,command,dt,session.config,session.track.boxes);
  session.lastPosition=before;
  try{
    const old=session.race;
    // A slide's endpoint chord is not its travelled polyline. Conservatively
    // suppress checkpoint credit on contact ticks instead of inventing a path.
    session.race=advanceRace(old,result.contacts.length?session.body.position:before,session.body.position,session.track);
    session.events=[...session.race.tickEvents];
    if(session.race.clearedGates>old.clearedGates){
      const index=(session.race.nextGate-1+session.track.gates.length)%session.track.gates.length;
      const g=session.track.gates[index],p=[g.x,g.y,g.z],axis=g.axis==='x'?0:2;
      p[axis]+=(g.direction??-1)*3;
      session.recoveryPosition=p;
    }
    if(result.contacts.length&&session.race.ticks-session.lastCollisionTick>=30){
      session.lastCollisionTick=session.race.ticks;session.collisions++;
      session.events.push({type:'collision',tick:session.race.ticks,index:session.collisions});
    }
  }catch(error){
    // A flight outside the representable Q16 region cannot earn a checkpoint.
    if(!(error instanceof RangeError))throw error;
    session.race={...session.race,status:'out-of-bounds'};
  }
  return result;
}
export function recoverSession(session){
  if(session.race.status!=='running')return false;
  const p=[...session.recoveryPosition],g=session.track.gates[session.race.nextGate];
  const yaw=Math.atan2(-(g.x-p[0]),-(g.z-p[2]));
  session.body.position=p;session.body.velocity=[0,0,0];session.body.angularVelocity=[0,0,0];
  session.body.orientation=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];session.lastPosition=[...p];
  session.race={...session.race,ticks:session.race.ticks+300,
    penaltyTicks:session.race.penaltyTicks+300,recoveries:session.race.recoveries+1};
  session.events=[{type:'recover',tick:session.race.ticks,index:session.race.recoveries}];return true;
}
export const secondsFromTicks=t=>t==null?null:(t/60).toFixed(2);
