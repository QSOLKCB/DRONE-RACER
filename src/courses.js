// SPDX-License-Identifier: Apache-2.0
import {DEFAULT_PACK,SPECTRUM_PACK} from './mods.js';
import {freeze} from './data.js';
// Authored cardinal circuits; every generated coordinate is an exact integer.
function circuit(id,title,width,depth,count,laps,accent){
  const points=[[0,0],[0,-depth],[width,-depth],[width,80],[0,80],[0,0]];
  const gates=[],obstacles=[];
  for(let side=0;side<5;side++){
    const a=points[side],b=points[side+1],n=side===4?1:count;
    const axis=a[0]===b[0]?'z':'x',index=axis==='x'?0:1,direction=Math.sign(b[index]-a[index]);
    for(let j=1;j<=n;j++){
      const x=Math.round(a[0]+(b[0]-a[0])*j/n),z=Math.round(a[1]+(b[1]-a[1])*j/n);
      const y=side===1?14:side===2?12:8;
      gates.push({id:'g'+String(gates.length+1).padStart(2,'0'),x:String(x),y:String(y),z:String(z),
        width:'20',height:'14',axis,direction});
      if(j<n){
        const p=[x,y,z];p[axis==='x'?0:2]+=direction*20;
        p[axis==='x'?2:0]+=id!=='neon-harbour'&&j%3===0?0:(j%2?1:-1)*4;
        const size=side===1?[6,4,6]:[3,y+4,3];
        const low=side===1?y-2:0;
        obstacles.push({id:'p'+obstacles.length,
          min:[String(p[0]-size[0]/2),String(low),String(p[2]-size[2]/2)],
          max:[String(p[0]+size[0]/2),String(low+size[1]),String(p[2]+size[2]/2)],color:'#ff9855'});
      }
    }
  }
  return freeze({kind:'qsol.drone-racer.pack.v1',id,version:1,title,accent,
    drone:{...DEFAULT_PACK.drone},course:{id,version:2,laps,spawn:['0','8','12'],gates,obstacles}});
}
export const NEON_CIRCUIT=circuit('neon-harbour','Neon Harbour',240,320,4,3,'#59ffdd');
export const FOUNDRY_CIRCUIT=circuit('foundry-run','Foundry Run',420,520,6,2,'#ffb45f');
export const SPECTRAL_CIRCUIT=circuit('spectral-endurance','Spectral Endurance',640,720,8,3,'#ba9aff');
export const PRESETS=Object.freeze({default:DEFAULT_PACK,spectrum:SPECTRUM_PACK,
  neon:NEON_CIRCUIT,foundry:FOUNDRY_CIRCUIT,endurance:SPECTRAL_CIRCUIT});
