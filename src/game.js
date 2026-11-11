// SPDX-License-Identifier: Apache-2.0
import {createBody,flightConfig,stepFlight} from '../engine/flight/index.js';
import {newRace,advanceRace,TRACK,validateTrack} from './track.js';
export const STEP=1/60;
export function createSession(track=TRACK,bestTicks=null){
  validateTrack(track);
  return {track,body:createBody({position:[0,3,5],halfSize:0.35,mass:1}),assisted:true,
    config:flightConfig({assisted:true,acceleration:36,maxSpeed:46,response:2.8,
      angularAcceleration:4,turnSpeed:2,angularResponse:6,brake:5}),
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
  session.race=advanceRace(session.race,before,session.body.position,session.track);
  return result;
}
export const secondsFromTicks=t=>t==null?null:(t/60).toFixed(2);
