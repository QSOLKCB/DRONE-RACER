// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {projectVertices} from '../engine/render-optional/index.js';
import bytes from '../engine/render-optional/wasm-bytes.js';
import {soundScore,tickSounds,SoundEventLog} from '../src/audio.js';
import {compileSkinPack,DEFAULT_SKIN_PACK,BUILTIN_SKINS} from '../src/skins.js';
import {RaceRenderer,droneGeometry} from '../src/scene.js';
import {createSession,stepSession} from '../src/game.js';
import {compilePack} from '../src/mods.js';
import {PRESETS} from '../src/courses.js';
import {compileRaceTrack} from '../src/track.js';
import {readPreferences,gamepadCommand,DEFAULTS} from '../src/preferences.js';
const oracle=input=>{
  const p=spawnSync('python3',['scripts/drone_003_oracle.py'],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:8e6,timeout:20000});
  assert.equal(p.status,0,p.stderr||String(p.error));return JSON.parse(p.stdout);
};
const pcmBytes=pcm=>{const out=Buffer.alloc(pcm.length*2);pcm.forEach((n,i)=>out.writeInt16LE(n,i*2));return out;};
test('new VANILLAJS modules remain byte-identical to the pinned donor commit',async()=>{
  const pins={'audio2d/index.js':'698d2cf9238999cbd6dfd50010c7ba3e49bc5e3a',
    'render-optional/index.js':'d89d5a041cd3929475f394773b09a917f50f0940',
    'render-optional/webgpu.js':'ff256e8a95a9ff11538c55ed2299c90a59192d69',
    'render-optional/wasm-bytes.js':'a04a09e164585bea8675e20ed458875f9521c0e0',
    'render-optional/project.wat':'674422d284ad3989458f89dbc33d09872d29e5e7'};
  for(const [path,hash] of Object.entries(pins)){
    const data=await readFile(new URL('../engine/'+path,import.meta.url));
    assert.equal(createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex'),hash,path);
  }
});
test('CPU and actual WASM projections equal independently rounded Python binary32 results bit for bit',async()=>{
  let state=0x831995;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
  const fixtures=Array.from({length:40},()=>({
    data:Array.from({length:60},(_,i)=>Math.fround(i%6<3?(random()-.5)*8000:random())),
    matrix:Array.from({length:16},()=>Math.fround((random()-.5)*4))}));
  const expected=oracle({projections:fixtures}).projections;
  const {instance}=await WebAssembly.instantiate(bytes),wasm=instance.exports;
  for(let i=0;i<fixtures.length;i++){
    const {data,matrix}=fixtures[i],cpu=projectVertices(Float32Array.from(data),Float32Array.from(matrix));
    new Float32Array(wasm.memory.buffer,0,16).set(matrix);new Float32Array(wasm.memory.buffer,64,data.length).set(data);
    wasm.project(64,4194304,0,data.length/6);
    const actual=new Float32Array(wasm.memory.buffer,4194304,cpu.length);
    const bits=a=>Array.from(new Uint32Array(a.buffer,a.byteOffset,a.length));
    assert.deepEqual(bits(cpu),bits(Float32Array.from(expected[i])),'CPU fixture '+i);
    assert.deepEqual(bits(actual),bits(Float32Array.from(expected[i])),'WASM fixture '+i);
  }
});
test('all sound cues agree with independent integer PCM oracle; chunk boundaries preserve exact bytes',()=>{
  const names=['gate','lap','finish','collision','recover','motor','music'];
  const scores=names.map((type,i)=>soundScore(type,i+3));
  const expected=oracle({pcm:scores.map(s=>({frames:s.frames,events:s.eventSummary()}))}).pcm;
  scores.forEach((score,i)=>{
    const full=score.renderAll(),split=317;
    const chunks=Buffer.concat([pcmBytes(score.renderRange(0,split)),pcmBytes(score.renderRange(split,score.frames-split))]);
    assert.deepEqual(chunks,pcmBytes(full));assert.equal(createHash('sha256').update(chunks).digest('hex'),expected[i],names[i]);
  });
});
test('tick-indexed logs are identical across different frame partitions and independent of mute',()=>{
  const run=partition=>{
    const s=createSession(),log=new SoundEventLog();let tick=0;
    while(tick<720)for(let i=0;i<partition&&tick<720;i++,tick++){
      stepSession(s,{thrust:[0,0,tick<120?-1:0],turn:[0,0,0],brake:tick>300});
      log.append(s);log.append(s); // duplicate render or export cannot append a tick twice
    }
    return log.export();
  };
  assert.deepEqual(run(1),run(6));assert.ok(run(1).events.length>100);
  assert.ok(run(1).events.every(e=>e.sample===e.tick*800));
  assert.deepEqual(tickSounds({...createSession(),race:{ticks:30},events:[]},{music:false,motor:false}),[]);
  const log=new SoundEventLog(2),s=createSession();s.race.ticks=30;log.append(s);s.race.ticks=60;log.append(s);
  assert.equal(log.events.length,2);assert.equal(log.truncated,true);
  const exported=log.export();exported.events[0].tick=999;assert.equal(log.events[0].tick,30);
});
test('six cosmetic skins are bounded, immutable, non-executable and include distinct body shapes',()=>{
  assert.equal(BUILTIN_SKINS.skins.length,6);
  const original=JSON.stringify(DEFAULT_SKIN_PACK),body=createSession().body;
  for(const s of BUILTIN_SKINS.skins){assert.ok(Object.isFrozen(s.parts));assert.ok(droneGeometry(s,body,12).every(Number.isFinite));}
  assert.notDeepEqual(droneGeometry(BUILTIN_SKINS.skins[0],body),droneGeometry(BUILTIN_SKINS.skins[2],body));
  assert.equal(JSON.stringify(DEFAULT_SKIN_PACK),original);
  for(const mutate of [s=>s.url='https://invalid.test/skin.js',s=>s.skins[0].mass=.1,
    s=>s.skins[0].colors.body='url(x)',s=>s.skins[0].parts[0].size=[1e9,1,1],
    s=>s.skins[0].parts[0].position=[0,NaN,0],s=>delete s.skins[1],
    s=>s.skins[1].id=s.skins[0].id,s=>s.skins[0].rotors[0].blades=100,
    s=>Object.defineProperty(s.skins[0],'parts',{get(){throw Error('must not run');}})]){
    const source=structuredClone(DEFAULT_SKIN_PACK);mutate(source);assert.throws(()=>compileSkinPack(source));
  }
});
test('distributed skin and circuit starters compile to their built-in definitions',async()=>{
  const skins=JSON.parse(await readFile(new URL('../mods/skins/independence-hangar.json',import.meta.url),'utf8'));
  assert.deepEqual(compileSkinPack(skins),BUILTIN_SKINS);
  const course=JSON.parse(await readFile(new URL('../mods/examples/neon-harbour.json',import.meta.url),'utf8'));
  assert.deepEqual(compilePack(course),compilePack(PRESETS.neon));
});
test('CPU quality, skins, camera and repeated frames cannot mutate authoritative flight or race',()=>{
  const ctx={fillRect(){},createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData(){}};
  const renderer=new RaceRenderer({width:320,height:180,getContext:()=>ctx});
  const s=createSession(compilePack(PRESETS.neon).track),control=createSession(s.track);
  for(let i=0;i<30;i++){
    const command={thrust:[0,0,-1],turn:[0,.1,0]};stepSession(s,command);stepSession(control,command);
    const race=structuredClone(s.race),body=structuredClone(s.body);
    s.camera='chase';renderer.setQuality(['eco','balanced','high'][i%3]);renderer.setSkin(BUILTIN_SKINS.skins[i%6]);
    renderer.draw(s,i*50);assert.equal(renderer.draw(s,i*50+1),false,'identical frame is skipped');
    assert.deepEqual(s.race,race);assert.deepEqual(s.body,body);
  }
  assert.deepEqual(s.body,control.body);assert.deepEqual(s.race,control.race);renderer.dispose();
});
test('preferences tolerate inaccessible storage and gamepad dead zones cancel resting input',()=>{
  assert.deepEqual(readPreferences({getItem(){throw Error('blocked');}}),DEFAULTS);
  assert.equal(readPreferences({getItem:()=>'{"quality":"extreme","volume":5,"backend":"gpu"}'}).volume,1);
  assert.deepEqual(gamepadCommand({axes:[.1,-.1,NaN,Infinity],buttons:[]}),{thrust:[0,0,0],turn:[0,-0,0],brake:false});
  const command=gamepadCommand({axes:[1,-1,1,-1],buttons:[{value:1}]});
  assert.equal(command.brake,true);assert.deepEqual(command.thrust,[1,0,-1]);
});
test('maximum-size zigzag course keeps procedural guide meshes within donor vertex budgets',()=>{
  const gates=Array.from({length:64},(_,i)=>({id:'g'+i,x:String(i%2?4000:-4000),y:'8',z:String(i*50),width:'20',height:'14',axis:'x',direction:i%2?1:-1}));
  const track=compileRaceTrack({id:'long-zigzag',version:2,laps:1,spawn:['0','30','0'],gates,obstacles:[]});
  const ctx={fillRect(){},createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData(){}};
  const renderer=new RaceRenderer({width:320,height:180,getContext:()=>ctx});
  renderer.setTrack(track,'#59ffdd');
  assert.ok([...renderer.renderer.meshes.values()].every(m=>m.data.length/6<=65536));
  renderer.dispose();
});
