// SPDX-License-Identifier: Apache-2.0
// Strict output is sample-indexed 48kHz PCM16. Device playback is presentation.
import {createSound2D,AUDIO2D_RATE} from '../engine/audio2d/index.js';
const notes=[262,294,330,392,440,523,588,660];
const variant=(type,index)=>type==='gate'?index%8:type==='motor'?Math.min(index,12):type==='music'?index%32:0;
export function soundScore(type,index=0){
  if(!Number.isSafeInteger(index)||index<0||index>1000000)throw new RangeError('bounded sound index required');
  index=variant(type,index);
  const event=(frequency,sample,duration,wave='triangle',channel=0,gain=3600)=>
    ({id:sample+channel+1,sample,duration,wave,channel,gain,frequency,seed:0xE800+index});
  let frames,events;
  switch(type){
    case 'gate':frames=12000;events=[event(notes[index%8],0,6000),event(notes[(index+2)%8],6000,6000)];break;
    case 'lap':case 'finish':frames=36000;events=[0,2,4,7].map((n,i)=>event(notes[n],i*8000,10000,'triangle',i%2,type==='finish'?5200:4000));break;
    case 'collision':frames=9600;events=[event(90,0,9600,'noise',0,5000)];break;
    case 'recover':frames=12000;events=[event(196,0,6000),event(131,6000,6000)];break;
    case 'motor':frames=6400;events=[event(65+Math.min(index,12)*12,0,6400,'triangle',0,1100)];break;
    case 'music':frames=14000;events=[event(notes[index%8],0,14000,'triangle',0,1500)];
      if(index%4===0)events.push(event(65+Math.floor(index/8)%2*33,0,14000,'triangle',1,2200));break;
    default:throw new TypeError('unknown sound cue');
  }
  return createSound2D({frames,events});
}
/** Full event choice depends on simulation tick/state, never Math.random/time. */
export function tickSounds(session,{music=true,motor=true}={}){
  const tick=session.race.ticks,events=session.events.map(e=>({type:e.type,index:e.index,tick}));
  if(music&&tick%15===0)events.push({type:'music',index:Math.floor(tick/15)%32,tick});
  if(motor&&tick%6===0)events.push({type:'motor',index:Math.min(12,Math.floor(Math.hypot(...session.body.velocity)/5)),tick});
  return events;
}
export class SoundEventLog{
  constructor(limit=50000){
    if(!Number.isInteger(limit)||limit<1||limit>50000)throw new RangeError('sound log limit must be 1..50000');
    this.limit=limit;this.events=[];this.truncated=false;this.lastTick=-1;
  }
  append(session){
    if(session.race.ticks<=this.lastTick)return;
    this.lastTick=session.race.ticks;
    for(const event of tickSounds(session)){
      if(this.events.length===this.limit){this.truncated=true;break;}
      this.events.push({...event,sample:event.tick*800});
    }
  }
  export(){return {kind:'qsol.drone-racer.sound-events.v1',tickRate:60,sampleRate:AUDIO2D_RATE,
    profile:'integer-pcm16-v1',truncated:this.truncated,events:this.events.map(e=>({...e}))};}
}
export class RaceAudio{
  constructor(){this.context=null;this.enabled=false;this.volume=.35;this.music=true;this.sources=new Set();this.cache=new Map();this.anchor=null;this.generation=0;}
  async enable(){
    const generation=++this.generation;
    const Context=globalThis.AudioContext??globalThis.webkitAudioContext;
    if(!Context)throw new Error('Audio is unavailable in this browser');
    this.context??=new Context();
    if(!this.gain){this.gain=this.context.createGain();this.gain.connect(this.context.destination);}
    await this.context.resume();
    if(generation!==this.generation)return false;
    this.enabled=true;this.setVolume(this.volume);return true;
  }
  setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.gain)this.gain.gain.setValueAtTime(this.volume,this.context.currentTime);}
  pause(){for(const source of this.sources){try{source.stop();}catch{}source.disconnect();}this.sources.clear();this.anchor=null;}
  disable(){++this.generation;this.enabled=false;this.pause();}
  update(session){
    if(!this.enabled||this.context?.state!=='running')return;
    for(const event of tickSounds(session,{music:this.music}))this.play(event);
  }
  play({type,index,tick}){
    if(!this.enabled||this.sources.size>=32)return;
    const ctx=this.context;
    this.anchor??={tick,time:ctx.currentTime+.02};
    const target=this.anchor.time+(tick-this.anchor.tick)/60;
    // Recovery penalties / stalled tabs cannot leave seconds of queued audio.
    if(target>ctx.currentTime+.2||target<ctx.currentTime-.2)this.anchor={tick,time:ctx.currentTime+.02};
    const when=Math.max(ctx.currentTime+.005,this.anchor.time+(tick-this.anchor.tick)/60);
    const normalized=variant(type,index);
    const key=type+':'+normalized;
    let buffer=this.cache.get(key);
    if(!buffer){
      const pcm=soundScore(type,normalized).renderAll();buffer=ctx.createBuffer(1,pcm.length,AUDIO2D_RATE);
      const channel=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)channel[i]=pcm[i]/32768;
      this.cache.set(key,buffer);
    }
    const source=ctx.createBufferSource();source.buffer=buffer;source.connect(this.gain);
    source.onended=()=>{this.sources.delete(source);source.disconnect();};this.sources.add(source);source.start(when);
  }
}
