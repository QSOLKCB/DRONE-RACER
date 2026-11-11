// SPDX-License-Identifier: Apache-2.0
// Packaged production scene regression: the ground must not paint over solids.
import assert from 'node:assert/strict';

export async function checkGroundAndVisibility(page){
  const result=await page.evaluate(async()=>{
    const {RaceRenderer,cameraMatrix,QUALITY}=await import('/src/scene.js');
    const {compileRaceTrack}=await import('/src/track.js');
    const {createSession,stepSession}=await import('/src/game.js');
    const {compilePack}=await import('/src/mods.js');
    const {PRESETS}=await import('/src/courses.js');
    const track=compileRaceTrack({id:'visibility-fixture',version:2,laps:1,spawn:['0','4','5'],
      gates:[[-80,-80],[80,-80],[80,80],[-80,80]].map(([x,z],i)=>({
        id:'g'+i,x:String(x),y:'8',z:String(z),width:'10',height:'10',axis:'z',direction:-1})),
      obstacles:[{id:'red-box',min:['-2','0','-12'],max:['2','4','-8'],color:'#ff2020'}]});
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;
    const renderer=new RaceRenderer(canvas),session=createSession(track),failures=[];
    let frames=0,samples=0;
    // Every target lies safely inside the exposed red front face, above the
    // ground. No other fixture geometry can occlude it. Moving past either
    // edge exercises the near plane, clipped floor and both box triangles.
    for(const quality of ['eco','balanced','high'])for(const camera of ['fpv','chase']){
      renderer.setQuality(quality);session.camera=camera;
      for(const y of [.4,1,4])for(const z of [-7,-4,0,12])for(const x of [-4,0,4]){
        session.body.position=[x,y,z];session.body.orientation=[0,0,0,1];
        const body=JSON.stringify(session.body),race=JSON.stringify(session.race);
        renderer.invalidate();renderer.draw(session,++frames*100);
        if(JSON.stringify(session.body)!==body||JSON.stringify(session.race)!==race)
          throw Error('visibility rendering mutated simulation');
        const matrix=cameraMatrix(session,4/3,QUALITY[quality].distance+100);
        for(const targetY of [.5,1,2,3]){
          const target=[0,targetY,-8];
          const clip=[0,1,2,3].map(k=>target[0]*matrix[k]+target[1]*matrix[k+4]+target[2]*matrix[k+8]+matrix[k+12]);
          const px=Math.floor((clip[0]/clip[3]+1)*200),py=Math.floor((1-clip[1]/clip[3])*150);
          if(clip[3]<=0||px<3||px>396||py<3||py>296)continue;
          // Chase drone can cover a tiny central patch; sample targets below
          // its body only where the ray is safely outside its silhouette.
          if(camera==='chase'&&Math.abs(px-200)<45&&Math.abs(py-202)<28)continue;
          const color=Array.from(canvas.getContext('2d').getImageData(px,py,1,1).data).slice(0,3);
          samples++;
          if(!(color[0]>40&&color[0]>2*color[1]&&color[0]>2*color[2]))
            failures.push({quality,camera,position:[x,y,z],targetY,pixel:[px,py],color});
        }
      }
    }
    renderer.dispose();
    const ground=[];
    for(const preset of Object.values(PRESETS))for(const location of ['spawn','rim']){
      const s=createSession(compilePack(preset).track);
      if(location==='rim')s.body.position=[s.track.bounds.max[0]-.01,3,s.track.bounds.max[2]-.01];
      // The downward command is deliberately held after impact: contact must
      // keep the whole collision body above the floor on subsequent ticks.
      let contacts=0,minClearance=Infinity;
      for(let tick=0;tick<180;tick++){
        const movement=stepSession(s,{thrust:[0,-1,0],turn:[0,0,0]});
        contacts+=movement.contacts.length;
        minClearance=Math.min(minClearance,s.body.position[1]-s.body.halfSize);
      }
      ground.push({id:s.track.id,location,contacts,minClearance,status:s.race.status});
    }
    return {frames,samples,failures,ground};
  });
  assert.ok(result.samples>300,'visibility fixture needs broad camera and quality coverage');
  assert.deepEqual(result.failures,[],'ground or other distant geometry hid an unobstructed obstacle');
  for(const row of result.ground){
    assert.ok(row.contacts>0,row.id+' must contact the floor');
    assert.ok(row.minClearance>=0,row.id+' passed beneath the floor');
    assert.equal(row.status,'running');
  }
  return {...result,visibility:'PASS',groundCollision:'PASS'};
}
