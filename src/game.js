// SPDX-License-Identifier: Apache-2.0
import {createBody,flightConfig,stepFlight} from '../engine/flight/index.js';
import {newRace,advanceRace,TRACK,validateTrack} from './track.js';
export const STEP=1/60;
export function createSession(track=TRACK,bestTicks=null,drone=null){
  validateTrack(track);
  return {track,body:createBody({position:[0,3,5],halfSize:drone?.halfSize??0.35,mass:drone?.mass??1}),
    droneName:drone?.name??'Independence Scout',droneColor:drone?.color??'#b7f9ee',
    camera:'fpv',accent:'#59ffdd',assisted:true,
    config:flightConfig({assisted:true,acceleration:drone?.acceleration??36,
      maxSpeed:drone?.maxSpeed??46,response:drone?.response??2.8,
      angularAcceleration:drone?.angularAcceleration??4,turnSpeed:drone?.turnSpeed??2,
      angularResponse:drone?.angularResponse??6,brake:drone?.brake??5}),
    race:newRace(bestTicks),lastPosition:[0,3,5]};
}
export function setFlightMode(session,assisted){
  session.assisted=Boolean(assisted);
  session.config=flightConfig({...session.config,assisted:session.assisted});
}
export function stepSession(session,command,dt=STEP){
  if(!Number.isFinite(dt)||dt<=0||dt>0.05)throw new RangeError('invalid step');
  if(session.race.status!=='running')return {contacts:[],truncated:false};
  const before=[...session.body.position];
  const result=stepFlight(session.body,command,dt,session.config,[]);
  session.lastPosition=before;
  try{
    session.race=advanceRace(session.race,before,session.body.position,session.track);
  }catch(error){
    // A flight outside the representable Q16 region cannot earn a checkpoint.
    if(!(error instanceof RangeError))throw error;
    session.race={...session.race,status:'out-of-bounds'};
  }
  return result;
}
export const secondsFromTicks=t=>t==null?null:(t/60).toFixed(2);
