// SPDX-License-Identifier: Apache-2.0
export const SETTINGS_KEY='qsol.drone-racer.preferences.v1';
export const DEFAULTS=Object.freeze({camera:'fpv',quality:'balanced',volume:.35,music:true,skin:'scout',minimap:true,sensitivity:1});
export function readPreferences(storage){
  let value;try{value=JSON.parse(storage?.getItem(SETTINGS_KEY)??'{}');}catch{value={};}
  if(!value||typeof value!=='object')value={};
  return {camera:['fpv','chase'].includes(value.camera)?value.camera:DEFAULTS.camera,
    quality:['eco','balanced','high'].includes(value.quality)?value.quality:DEFAULTS.quality,
    volume:typeof value.volume==='number'&&Number.isFinite(value.volume)?Math.max(0,Math.min(1,value.volume)):DEFAULTS.volume,
    music:typeof value.music==='boolean'?value.music:DEFAULTS.music,
    skin:typeof value.skin==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(value.skin)?value.skin:DEFAULTS.skin,
    minimap:typeof value.minimap==='boolean'?value.minimap:DEFAULTS.minimap,
    sensitivity:[.5,1,1.5].includes(value.sensitivity)?value.sensitivity:DEFAULTS.sensitivity};
}
export function savePreferences(storage,value){try{storage?.setItem(SETTINGS_KEY,JSON.stringify(value));}catch{}}
export function gamepadCommand(pad){
  const axis=i=>{const v=pad?.axes?.[i];return Number.isFinite(v)&&Math.abs(v)>.16?Math.sign(v)*Math.min(1,(Math.abs(v)-.16)/.84):0;};
  const button=i=>Math.max(0,Math.min(1,pad?.buttons?.[i]?.value||0));
  return {thrust:[axis(0),button(7)-button(6),axis(1)],turn:[axis(3),-axis(2),button(4)-button(5)],brake:button(0)>.5};
}
