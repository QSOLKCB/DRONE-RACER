// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compilePack,DEFAULT_PACK,SPECTRUM_PACK} from '../src/mods.js';
import {TRACK,TRACK_SOURCE,compileRaceTrack,newRace,advanceRace} from '../src/track.js';
import {positionToRawQ16,pointToRawQ16} from '../src/position-q16.js';
import {createSession,stepSession,STEP} from '../src/game.js';
import {drawScene} from '../src/render.js';
const clone=v=>structuredClone(v);

test('separate pinned ALIEN MATH and legacy flight source inventories are exact blobs',async()=>{
 const pins={
   'exact-course':'fb38dad5e93ea761a5268e5fad6100095b939dd8',
   'exact-rational':'083ffac067310fc95ba9a17644ee2c4a395b9357',
   'rational-q16':'310a0bea3cc2d42bf64e78290931f41ff60d0c9a',
   'integer-math':'d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9'
 };
 for(const [name,pin] of Object.entries(pins)){
   const bytes=await readFile(new URL('../engine/'+name+'/index.js',import.meta.url));
   const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   assert.equal(sha,pin,name+' must equal the reviewed VANILLAJS blob');
 }
});
test('production float-to-Q16 boundary agrees with independent Fraction.from_float',()=>{
 const run=spawnSync('python3',['scripts/drone_002_oracle.py'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const oracle=JSON.parse(run.stdout);
 assert.equal(oracle.kind,'qsol.drone.float-q16.oracle.v1');
 assert.ok(oracle.cases.length>=1700);
 for(const [x,raw] of oracle.cases)assert.equal(positionToRawQ16(x),raw,String(x));
 assert.equal(positionToRawQ16(-0),0);
 assert.deepEqual(pointToRawQ16([0.1,-0.1,3]),[6553,-6553,196608]);
 for(const input of [NaN,Infinity,-Infinity,'1',null,{}])
   assert.throws(()=>positionToRawQ16(input),TypeError);
 for(const input of [32768, -32768.1, Number.MAX_VALUE])
   assert.throws(()=>positionToRawQ16(input),RangeError);
});
test('ALIEN MATH gates accept swept ordered crossings and retain missed-gate stopping',()=>{
 const t=compileRaceTrack(TRACK_SOURCE);
 assert.equal(t.gates.length,TRACK.gates.length);
 assert.equal(advanceRace(newRace(),[0,3,0],[0,3,-100],t).nextGate,2);
 assert.equal(advanceRace(newRace(),[0,3,0],[0,3,-300],t).status,'finished');
 const missed=advanceRace(newRace(),[-10,3,0],[20,3,-150],t);
 assert.equal(missed.nextGate,1);
 assert.equal(advanceRace(missed,[20,3,-150],[20,3,-300],t).nextGate,1);
});
test('quantized closed edge and sub-ULP differences are explicit',()=>{
 const before=[7,3,0],to=[7,3,-40];
 assert.equal(advanceRace(newRace(),before,to,TRACK).nextGate,1);
 assert.equal(advanceRace(newRace(),[7+1/65536,3,0],[7+1/65536,3,-40],TRACK).nextGate,0);
 // Less than one raw Q16 unit truncates to the edge: admission is about
 // represented/quantized position, not the continuous Float64 trajectory.
 assert.equal(advanceRace(newRace(),[7+1/131072,3,0],[7+1/131072,3,-40],TRACK).nextGate,1);
});
test('real Float64 flight is unchanged and checkpoint verdict is exact',()=>{
 const s=createSession();
 for(let i=0;i<150;i++)stepSession(s,{thrust:[0,0,-1],turn:[0,0,0],brake:false},STEP);
 assert.equal(s.race.ticks,150);
 assert.ok(s.race.nextGate>=1);
 const doomed=createSession();
 doomed.body.position=[0,3,-32767.99];
 doomed.body.velocity=[0,0,-100];
 stepSession(doomed,{thrust:[0,0,0],turn:[0,0,0],brake:false});
 assert.equal(doomed.race.status,'out-of-bounds');
});
test('built-in mods and imported course examples compile without executable capabilities',async()=>{
 const a=compilePack(DEFAULT_PACK),b=compilePack(SPECTRUM_PACK);
 assert.equal(a.track.gates.length,6);
 assert.equal(b.drone.name,'Spectral Wasp');
 assert.notEqual(a.accent,b.accent);
 assert.notEqual(a.track.id,b.track.id);
 for(const [name,expected] of [
   ['independence-scout',a],['spectrum-dash',b]]){
   const raw=JSON.parse(await readFile(new URL('../mods/examples/'+name+'.json',import.meta.url),'utf8'));
   const imported=compilePack(raw);
   assert.equal(imported.track.id,expected.track.id);
   assert.equal(imported.drone.name,expected.drone.name);
   assert.deepEqual(imported.track.gates,expected.track.gates,
     name+' example must match built-in gate geometry');
   assert.deepEqual(imported.drone,expected.drone,
     name+' example must match built-in drone config');
 }
});
test('untrusted or malformed packs fail closed, with no code loading',()=>{
 const good=clone(DEFAULT_PACK);
 good.drone.color='javascript:alert(1)';assert.throws(()=>compilePack(good),TypeError);
 const bad=clone(DEFAULT_PACK);bad.script='alert(1)';
 assert.throws(()=>compilePack(bad),TypeError);
 const forged=clone(DEFAULT_PACK);
 Object.defineProperty(forged.drone,'name',{get(){throw Error('must never execute getter');}});
 assert.throws(()=>compilePack(forged),TypeError);
 const invalid=clone(DEFAULT_PACK);invalid.course.gates[0].width='NaN';
 assert.throws(()=>compilePack(invalid),TypeError);
 const huge=clone(DEFAULT_PACK);huge.drone.acceleration=100000;
 assert.throws(()=>compilePack(huge),RangeError);
 const duplicate=clone(DEFAULT_PACK);duplicate.course.gates[1].id='01';
 assert.throws(()=>compilePack(duplicate),TypeError);
});
test('custom drone parameters flow into flight and do not mutate default engine constants',()=>{
 const p=compilePack(SPECTRUM_PACK);
 const session=createSession(p.track,null,p.drone);
 assert.equal(session.config.acceleration,48);
 assert.equal(session.config.maxSpeed,62);
 assert.equal(session.body.mass,0.75);
 assert.equal(session.droneName,'Spectral Wasp');
 assert.equal(createSession().config.acceleration,36);
});
test('chase view draws custom drone colour without mutating race, flight or gate count',()=>{
 function recording(){
   const strokes=[];
   const ctx={createLinearGradient:()=>({addColorStop(){}}),
     createRadialGradient:()=>({addColorStop(){}}),
     fillRect(){},save(){},restore(){},fillText(){},arc(){},beginPath(){},
     moveTo(){},lineTo(){},stroke(){strokes.push(this.strokeStyle)}};
   return {canvas:{width:960,height:540,getContext:()=>ctx},strokes};
 }
 const pack=compilePack(SPECTRUM_PACK),session=createSession(pack.track,null,pack.drone);
 session.accent=pack.accent;
 const original=[...session.body.position],before=clone(session.race);
 const fpv=recording();drawScene(fpv.canvas,session);
 session.camera='chase';
 const chase=recording();drawScene(chase.canvas,session);
 assert.ok(chase.strokes.filter(s=>s===session.droneColor).length>=3);
 assert.deepEqual(session.body.position,original);
 assert.deepEqual(session.race,before);
});
