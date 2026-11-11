// SPDX-License-Identifier: Apache-2.0
// First-party, data-only drone/track packs. No eval, code loading or network API.
// Future VANILLAJS Mod SDK can replace this limited local authoring contract.
import {TRACK_SOURCE,compileRaceTrack} from './track.js';
const KIND='qsol.drone-racer.pack.v1';
const FIELDS=['kind','id','version','title','accent','drone','course'];
const DRONE=['name','color','mass','halfSize','acceleration','maxSpeed','response',
  'angularAcceleration','turnSpeed','angularResponse','brake'];
function ownData(value,keys){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
     ![Object.prototype,null].includes(Object.getPrototypeOf(value)))
    throw new TypeError('plain pack record required');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length||keys.some(k=>!Object.hasOwn(descriptors,k)||
       !Object.hasOwn(descriptors[k],'value'))||
     own.some(k=>typeof k!=='string'||!keys.includes(k)))
    throw new TypeError('unexpected, missing or accessor pack property');
  return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
}
const limits=Object.freeze({
  mass:[0.1,20],halfSize:[0.1,1.5],acceleration:[2,80],maxSpeed:[5,120],
  response:[0.1,10],angularAcceleration:[0.1,12],turnSpeed:[0.1,8],
  angularResponse:[0.1,12],brake:[0.1,15]
});
function validateDrone(value){
  const d=ownData(value,DRONE);
  if(typeof d.name!=='string'||d.name.length<1||d.name.length>48||
     !/^#[0-9a-fA-F]{6}$/.test(d.color))
    throw new TypeError('invalid drone identity or colour');
  for(const [key,[min,max]] of Object.entries(limits)){
    if(typeof d[key]!=='number'||!Number.isFinite(d[key])||
       d[key]<min||d[key]>max)throw new RangeError('invalid drone stat: '+key);
  }
  return Object.freeze(d);
}
export function compilePack(value){
  const data=ownData(value,FIELDS);
  if(data.kind!==KIND||data.version!==1||
     typeof data.id!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(data.id)||
     typeof data.title!=='string'||data.title.length<1||data.title.length>80||
     !/^#[0-9a-fA-F]{6}$/.test(data.accent))
    throw new TypeError('invalid mod pack identity or accent');
  const drone=validateDrone(data.drone);
  const track=compileRaceTrack(data.course,data.title);
  return Object.freeze({id:data.id,version:1,title:data.title,
    accent:data.accent,drone,track});
}
const BASE_DRONE=Object.freeze({
  name:'Independence Scout',color:'#b7f9ee',mass:1,halfSize:0.35,
  acceleration:36,maxSpeed:46,response:2.8,angularAcceleration:4,
  turnSpeed:2,angularResponse:6,brake:5
});
export const DEFAULT_PACK=Object.freeze({
  kind:KIND,id:'independence-sprint',version:1,title:'Independence Sprint',
  accent:'#59ffdd',drone:BASE_DRONE,course:TRACK_SOURCE
});
export const SPECTRUM_PACK=Object.freeze({
  kind:KIND,id:'spectrum-dash',version:1,title:'Spectrum Dash',
  accent:'#ff68dc',
  drone:Object.freeze({...BASE_DRONE,name:'Spectral Wasp',color:'#ff95e6',
    mass:0.75,acceleration:48,maxSpeed:62,turnSpeed:2.6}),
  course:Object.freeze({id:'spectrum-dash',version:1,
    gates:Object.freeze(TRACK_SOURCE.gates.map((g,i)=>Object.freeze({
      ...g,x:String(Number(g.x)+[0,1,0,-2,1,0][i]),
      y:String(Number(g.y)+[0,0.5,0,0.5,0.5,0][i])
    })))})
});
