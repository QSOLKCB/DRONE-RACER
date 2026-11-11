// SPDX-License-Identifier: Apache-2.0
import {record,list,bounded,label,identifier,color,freeze} from './data.js';
export const SKIN_LIMIT=65536;
const slots=['body','trim','rotor','canopy'];
const triple=(v,min,max)=>list(v,3,3).map(n=>bounded(n,min,max));
export function compileSkinPack(source){
  const s=record(source,['kind','id','version','title','author','skins']);
  if(s.kind!=='qsol.drone-racer.skins.v1'||s.version!==1)throw new TypeError('skin pack v1 required');
  identifier(s.id);label(s.title);label(s.author);
  const seen=new Set();
  const skins=list(s.skins,1,16).map(raw=>{
    const v=record(raw,['id','name','colors','parts','rotors']);identifier(v.id);label(v.name,48);
    if(seen.has(v.id))throw new TypeError('duplicate skin ID');seen.add(v.id);
    const colors=record(v.colors,slots);slots.forEach(k=>color(colors[k]));
    const parts=list(v.parts,1,48).map(raw=>{
      const p=record(raw,['position','size','color']);
      const position=triple(p.position,-2,2),size=triple(p.size,.03,3);
      if(!slots.includes(p.color)||position.some((n,i)=>Math.abs(n)+size[i]/2>2))
        throw new RangeError('skin part escapes 4m cosmetic bounds');
      return {position,size,color:p.color};
    });
    const rotors=list(v.rotors,0,8).map(raw=>{
      const r=record(raw,['position','radius','blades']);const position=triple(r.position,-1.5,1.5);
      bounded(r.radius,.1,.6);
      if(!Number.isInteger(r.blades)||r.blades<2||r.blades>5||
        Math.abs(position[0])+r.radius>2||Math.abs(position[2])+r.radius>2)
        throw new RangeError('invalid rotor');
      return {position,radius:r.radius,blades:r.blades};
    });
    return {id:v.id,name:v.name,colors,parts,rotors};
  });
  return freeze({id:s.id,title:s.title,author:s.author,skins});
}
const part=(position,size,color='body')=>({position,size,color});
function skin(id,name,body,trim,shape){
  const wide=shape==='manta'?1.3:shape==='hauler'?1.1:.85;
  const long=shape==='razor'?1.1:.7;
  const parts=[part([0,0,0],[shape==='manta'?.9:.5,.25,shape==='razor'?1.5:.85]),
    part([0,.18,-.18],[.36,.14,.45],'canopy'),
    part([0,0,-long],[wide*2,.08,.12],'trim'),part([0,0,long],[wide*2,.08,.12],'trim'),
    part([0,.08,.4],[.15,.15,.18],'trim')];
  if(shape==='hauler')parts.push(part([-.35,-.3,0],[.09,.35,.9],'trim'),part([.35,-.3,0],[.09,.35,.9],'trim'));
  if(shape==='manta')parts.push(part([0,.05,.25],[2.5,.06,.3],'trim'));
  if(shape==='razor')parts.push(part([0,.27,.42],[.08,.45,.4],'trim'));
  return {id,name,colors:{body,trim,rotor:trim,canopy:'#b9e7ff'},parts,
    rotors:[-wide,wide].flatMap(x=>[-long,long].map(z=>({position:[x,.06,z],radius:.3,blades:3})))};
}
export const DEFAULT_SKIN_PACK=freeze({kind:'qsol.drone-racer.skins.v1',id:'independence-hangar',version:1,
  title:'Independence Hangar',author:'QSOL-IMC',skins:[
    skin('scout','Independence Scout','#e4fcf6','#59ffdd','scout'),
    skin('wasp','Spectral Wasp','#e3a7ff','#ff62c7','scout'),
    skin('manta','Tidal Manta','#256a9f','#7de6ff','manta'),
    skin('razor','Solar Razor','#ffc16b','#ff704d','razor'),
    skin('hauler','Foundry Hauler','#aab8c5','#ffdc65','hauler'),
    skin('ghost','Void Ghost','#8585c7','#c3abff','razor')
  ]});
export const BUILTIN_SKINS=compileSkinPack(DEFAULT_SKIN_PACK);
