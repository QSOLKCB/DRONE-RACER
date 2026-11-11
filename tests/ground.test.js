// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBody,stepFlight} from '../engine/flight/index.js';
import {compileRaceTrack,TRACK} from '../src/track.js';
import {createSession,stepSession,setFlightMode,STEP} from '../src/game.js';
import {PRESETS} from '../src/courses.js';
import {compilePack} from '../src/mods.js';

test('every preset stops sustained descent at the visible ground, including the former non-solid rim',()=>{
  for(const [id,source] of Object.entries(PRESETS)){
    const pack=compilePack(source),track=pack.track;
    assert.ok(track.boxes.includes(track.bounds),id+' shares its rendering and collision slab');
    assert.ok(Object.isFrozen(track.bounds.min)&&Object.isFrozen(track.bounds.max));
    for(const assisted of [true,false])for(const halfSize of [.1,.35,1.5]){
      const s=createSession(track,null,{...pack.drone,halfSize});setFlightMode(s,assisted);
      // The old collider ended 15m short of the displayed floor. Stay close to
      // the displayed corner, where there are no gate frames or obstacles.
      s.body.position=[track.bounds.max[0]-.01,3,track.bounds.max[2]-.01];
      let hit=false;
      for(let i=0;i<240;i++){
        const result=stepSession(s,{thrust:[0,-1,0]});
        hit ||= result.contacts.some(c=>c.normal[1]===1);
        assert.ok(s.body.position[1]>=halfSize,`${id} ${assisted} ${halfSize} tick ${i}`);
        assert.equal(result.truncated,false);
      }
      assert.ok(hit,id+' must hit the ground');
      assert.ok(Math.abs(s.body.position[1]-halfSize)<1e-5);
      assert.equal(s.body.velocity[1],0);
      assert.equal(s.race.status,'running');
      assert.equal(s.race.nextGate,0,'ground contacts cannot award checkpoints');
      assert.ok(s.collisions>0);
      // Ground response removes only inward motion, so lifting off still works.
      for(let i=0;i<60;i++)stepSession(s,{thrust:[0,1,0]});
      assert.ok(s.body.position[1]>halfSize+1,id+' can take off again');
    }
  }
});

test('a 50ms high-speed descent cannot tunnel through the ground and retains lateral sliding',()=>{
  for(const source of Object.values(PRESETS)){
    const {track}=compilePack(source),s=createSession(track);setFlightMode(s,false);
    const start=[track.bounds.max[0]-2,10,track.bounds.max[2]-2];
    s.body.position=[...start];s.body.velocity=[-4,-10000,-6];
    const result=stepSession(s,{},.05);
    assert.equal(result.truncated,false);
    assert.ok(result.contacts.some(c=>c.normal[1]===1));
    assert.ok(Math.abs(s.body.position[1]-s.body.halfSize)<1e-5);
    assert.ok(Math.abs(s.body.position[0]-(start[0]-.2))<1e-10);
    assert.ok(Math.abs(s.body.position[2]-(start[2]-.3))<1e-10);
    assert.deepEqual(s.body.velocity,[-4,0,-6]);
  }
});

test('custom circuit ground includes remote spawns and obstacle footprints and remains a finite slab',()=>{
  const source=structuredClone(PRESETS.neon.course);
  source.spawn=['-3000','30','-3000'];
  source.obstacles.push({id:'remote-box',min:['3000','0','3000'],max:['3010','5','3010'],color:'#abcdef'});
  const track=compileRaceTrack(source);
  assert.deepEqual(track.bounds,{min:[-3065,-2,-3065],max:[3075,0,3075]});
  const s=createSession(track);setFlightMode(s,false);
  s.body.position=[3076,1,3076];s.body.velocity=[0,-120,0];
  const result=stepSession(s,{});
  assert.equal(result.contacts.length,0,'empty space beyond the visible slab has no invisible floor');
  assert.ok(s.body.position[1]<0);
});

test('adding sprint ground leaves ordinary airborne flight identical to the pinned kernel',()=>{
  const s=createSession(TRACK),body=createBody({position:TRACK.spawn,halfSize:.35});
  for(let tick=0;tick<240;tick++){
    const command={thrust:[tick<120?1:-1,0,-1],turn:[0,.1,0]};
    stepSession(s,command);stepFlight(body,command,STEP,s.config,[]);
    assert.deepEqual(s.body,body);
  }
});
