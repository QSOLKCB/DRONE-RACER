// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {compileRaceTrack,newRace,advanceRace} from '../src/track.js';
import {circuitCrossing} from '../src/circuit.js';
import {pointToRawQ16} from '../src/position-q16.js';
import {createSession,stepSession,setFlightMode,recoverSession} from '../src/game.js';
import {PRESETS} from '../src/courses.js';
import {compilePack} from '../src/mods.js';
const source=(axis='x',direction=1,planes=[10,20,30,0])=>({id:'test-circuit',version:2,laps:2,
  spawn:['-20','30','50'],gates:planes.map((p,i)=>({id:'g'+i,x:axis==='x'?String(p):'0',
    y:'8',z:axis==='z'?String(p):'0',width:'20',height:'14',axis,direction})),obstacles:[]});
const sweep=(g,a,b,side=0,y=8)=>{
  const from=[side,y,side],to=[side,y,side],i=g.axis==='x'?0:2;from[i]=a;to[i]=b;return [from,to];
};
test('v2 all four cardinal directions agree with an independent Fraction intersection oracle',()=>{
  const cases=[],actual=[];
  for(const axis of ['x','z'])for(const direction of [-1,1]){
    const t=compileRaceTrack(source(axis,direction));const g=t.gates[0];
    for(let i=0;i<512;i++){
      const side=[-10-1/65536,-10,0,10,10+1/65536,30][i%6];
      const y=[1-1/65536,1,8,15,15+1/65536][i%5];
      const a=10+(i%8-4)*direction,b=10+(i%13-6)*direction;
      const [from,to]=sweep(g,a,b,side,y).map(pointToRawQ16);
      cases.push({gate:g,from,to});actual.push(Boolean(circuitCrossing(g,from,to)));
    }
    assert.equal(advanceRace(newRace(),...sweep(g,10-direction,10+direction),t).nextGate,1);
    assert.equal(advanceRace(newRace(),...sweep(g,10+direction,10-direction),t).nextGate,0);
    assert.equal(advanceRace(newRace(),...sweep(g,10-direction,10+direction,11),t).nextGate,0);
  }
  const oracle=spawnSync('python3',['scripts/drone_003_oracle.py'],{input:JSON.stringify({crossings:cases}),encoding:'utf8',maxBuffer:4e6});
  assert.equal(oracle.status,0,oracle.stderr);assert.deepEqual(actual,JSON.parse(oracle.stdout).crossings);
  assert.ok(actual.some(Boolean)&&actual.some(x=>!x));
});
test('multi-gate sweep is chronological, stops at misses, and cannot consume coincident gates',()=>{
  const ordered=compileRaceTrack(source());
  assert.equal(advanceRace(newRace(),[0,8,0],[35,8,0],ordered).nextGate,3);
  const reversed=compileRaceTrack(source('x',1,[10,5,30,0]));
  assert.equal(advanceRace(newRace(),[0,8,0],[35,8,0],reversed).nextGate,1);
  const simultaneous=compileRaceTrack(source('x',1,[10,10,30,0]));
  assert.equal(advanceRace(newRace(),[0,8,0],[35,8,0],simultaneous).nextGate,1);
  assert.equal(advanceRace(newRace(),[0,30,0],[35,30,0],ordered).nextGate,0);
});
test('last gate and next lap first gate in one sweep retain strict physical order',()=>{
  const track=compileRaceTrack(source()),race={...newRace(),ticks:100,nextGate:3,clearedGates:3};
  const next=advanceRace(race,[-5,8,0],[15,8,0],track);
  assert.equal(next.completedLaps,1);assert.equal(next.nextGate,1);assert.equal(next.clearedGates,5);
  assert.equal(next.ticks,101);assert.deepEqual(next.lapTimes,[101]);
  assert.deepEqual(next.tickEvents.map(e=>e.type),['gate','lap','gate']);
  assert.ok(next.tickEvents.every(e=>e.tick===101));
  const last=advanceRace({...race,completedLaps:1,lapTimes:[50],lapStartedTicks:50},[-5,8,0],[15,8,0],track);
  assert.equal(last.status,'finished');assert.equal(last.nextGate,4);assert.equal(last.completedLaps,2);
  assert.deepEqual(last.lapTimes,[50,51]);assert.deepEqual(last.tickEvents.map(e=>e.type),['gate','finish']);
  assert.deepEqual(advanceRace(last,[-5,8,0],[35,8,0],track),last);
});
test('plane endpoints and simultaneous lap boundaries have explicit one-crossing semantics',()=>{
  const t=compileRaceTrack(source()),r={...newRace(),nextGate:3,clearedGates:3};
  const onPlane=advanceRace(r,[-5,8,0],[0,8,0],t);
  assert.equal(onPlane.completedLaps,1);assert.equal(onPlane.nextGate,0);
  assert.equal(advanceRace(onPlane,[0,8,0],[15,8,0],t).nextGate,1);
  assert.equal(advanceRace(r,[0,8,0],[15,8,0],t).nextGate,3,'starting on the plane does not cross it');
  const coincident=compileRaceTrack(source('x',1,[0,20,30,0]));
  const lap=advanceRace(r,[-5,8,0],[15,8,0],coincident);
  assert.equal(lap.completedLaps,1);assert.equal(lap.nextGate,0,'simultaneous first gate must be re-approached');
});
test('real swept collisions before or after a gate suppress every checkpoint on the contact tick',()=>{
  for(const x of [8,12]){
    const src=source();src.obstacles=[{id:'wall',min:[String(x),'0','-3'],max:[String(x+1),'20','3'],color:'#ff9955'}];
    const session=createSession(compileRaceTrack(src));setFlightMode(session,false);
    session.body.position=[0,8,0];session.body.velocity=[1000,0,0];
    const result=stepSession(session,{thrust:[0,0,0],turn:[0,0,0]});
    assert.ok(result.contacts.length);assert.equal(result.truncated,false);
    assert.ok(session.body.position[0]<x-session.body.halfSize);
    assert.equal(session.race.nextGate,0);assert.equal(session.race.completedLaps,0);
    assert.equal(session.race.ticks,1);assert.equal(session.race.status,'running');
    assert.deepEqual(session.events.map(e=>e.type),['collision']);
  }
});
test('recovery uses last verified checkpoint, preserves progression, and adds a five-second penalty',()=>{
  const s=createSession(compilePack(PRESETS.neon).track);const before=structuredClone(s.race);
  s.body.position=[1000,50,1000];s.body.velocity=[100,100,100];
  assert.equal(recoverSession(s),true);assert.deepEqual(s.body.position,s.track.spawn);
  assert.deepEqual(s.body.velocity,[0,0,0]);assert.equal(s.race.nextGate,before.nextGate);
  assert.equal(s.race.ticks,300);assert.equal(s.race.penaltyTicks,300);assert.equal(s.race.recoveries,1);
  s.race.status='finished';assert.equal(recoverSession(s),false);
});
test('every built-in circuit completes all laps, with safe spawn and retained legacy courses',()=>{
  for(const [id,source] of Object.entries(PRESETS)){
    const pack=compilePack(source),t=pack.track;let r=newRace();
    for(let lap=0;lap<t.laps;lap++)for(const g of t.gates){
      const axis=g.axis==='x'?0:2,p=[g.x,g.y,g.z],from=[...p],to=[...p];
      from[axis]-=g.direction??-1;to[axis]+=g.direction??-1;
      r=advanceRace(r,from,to,t);
    }
    assert.equal(r.status,'finished',id);assert.equal(r.completedLaps,t.laps);
    assert.equal(r.clearedGates,t.laps*t.gates.length);
    if(t.version===2){assert.ok(t.length>1000);assert.ok(t.obstacles.length);assert.ok(t.boxes.length>t.gates.length*4);}
  }
});
test('v2 rejects executable fields, bad exact values, sparse arrays, invalid laps and blocked spawns',()=>{
  for(const mutate of [s=>s.script='evil',s=>s.laps=0,s=>s.laps=10,s=>s.gates[0].axis='y',
    s=>s.gates[0].direction=0,s=>s.gates[0].width='0.1',s=>s.gates[0].x='0.1',
    s=>delete s.gates[1],s=>s.gates[1].id=s.gates[0].id,
    s=>s.spawn=['10','1','10'],s=>Object.defineProperty(s.gates[0],'x',{get(){throw Error('getter executed');}})]){
    const s=source();mutate(s);assert.throws(()=>compileRaceTrack(s),/property|range|gate|aperture|exact|duplicate|array|solid|cardinal|quantiz|policy/i);
  }
});
