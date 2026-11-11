// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACK,validateTrack,gateCrossing,newRace,advanceRace} from '../src/track.js';
import {STEP,createSession,stepSession,setFlightMode,secondsFromTicks} from '../src/game.js';
test('course geometry bounded, finite and ordered',()=>{
  assert.equal(validateTrack(TRACK),TRACK);assert.equal(TRACK.gates.length,6);
  assert.equal(Object.isFrozen(TRACK.gates[0]),true);
  assert.throws(()=>validateTrack({...TRACK,gates:[...TRACK.gates,TRACK.gates[0]]}));
  assert.throws(()=>validateTrack({...TRACK,gates:TRACK.gates.map((g,i)=>i===2?{...g,z:-1}:g)}));
  assert.throws(()=>validateTrack({...TRACK,gates:TRACK.gates.map((g,i)=>i===0?{...g,x:NaN}:g)}));
});
test('swept gate disallows reverse, wrong-side and missed crossings',()=>{
  const g=TRACK.gates[0];
  assert.ok(gateCrossing([0,3,0],[0,3,-80],g));
  assert.equal(gateCrossing([0,3,-80],[0,3,0],g),null);
  assert.equal(gateCrossing([30,3,0],[30,3,-80],g),null);
  assert.equal(gateCrossing([0,30,0],[0,30,-80],g),null);
  assert.equal(gateCrossing([0,3,-60],[0,3,-80],g),null);
  assert.throws(()=>gateCrossing([NaN,0,0],[0,0,0],g));
});
test('mandatory ordered gates and terminal tick-based timing',()=>{
  let race=newRace();
  race=advanceRace(race,[0,3,0],[0,3,-90],TRACK);
  assert.equal(race.nextGate,1);
  race=advanceRace(race,[0,3,-150],[0,3,-180],TRACK);
  assert.equal(race.nextGate,1);
  for(let i=1;i<TRACK.gates.length;i++){
    const g=TRACK.gates[i];
    race=advanceRace(race,[g.x,g.y,g.z+1],[g.x,g.y,g.z-1],TRACK);
  }
  assert.equal(race.status,'finished');assert.equal(race.finishedTicks,race.ticks);
  assert.equal(race.bestTicks,race.ticks);
  assert.deepEqual(advanceRace(race,[0,3,0],[0,3,-100],TRACK),race);
});
test('pinned VANILLAJS flight advances exactly 150 declared simulation ticks',()=>{
  const s=createSession();
  for(let i=0;i<150;i++)stepSession(s,{thrust:[0,0,-1],turn:[0,0,0],brake:false});
  assert.ok(s.body.position[2]<-28);
  assert.ok(s.race.nextGate>=1);
  assert.equal(s.race.ticks,150);
  assert.equal(STEP,1/60);
  setFlightMode(s,false);assert.equal(s.assisted,false);
  assert.throws(()=>stepSession(s,{},0.1));
  assert.equal(secondsFromTicks(123),'2.05');
});
test('invalid local record time fails closed',()=>{
  assert.equal(newRace(75).bestTicks,75);
  for(const v of [-1,0,1.2,Infinity,'20'])assert.throws(()=>newRace(v));
});
