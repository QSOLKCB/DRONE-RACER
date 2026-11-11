// SPDX-License-Identifier: Apache-2.0
// Actual production WASM/WebGPU backend, tested on a software WebGPU adapter.
// Pixel checks use a separate scalar barycentric raster oracle as well as Canvas.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const triangle=(points,color)=>points.flatMap(p=>[...p,...color]);
const green=[.25,.75,.5],orange=[1,.5,.25];
const fixtures=[
  {name:'interior',data:triangle([[-.8,-.8,0],[.8,-.8,0],[0,.8,0]],green)},
  {name:'near-plane',data:triangle([[-.8,-.8,-1.4],[.8,-.8,.2],[0,.9,.2]],green)},
  {name:'viewport',data:triangle([[-1.6,-.8,0],[.8,-.8,0],[.3,1.5,0]],green)},
  {name:'depth',data:[...triangle([[-.8,-.8,.4],[.8,-.8,.4],[0,.8,.4]],green),
    ...triangle([[-.5,-.5,-.4],[.5,-.5,-.4],[0,.5,-.4]],orange)]},
  {name:'perspective',data:triangle([[-1,-.8,-2],[1,-.8,-2],[0,.8,-1]],green),
    matrix:[1.2,0,0,0,0,1.2,0,0,0,0,-1.020202,-1,0,0,-.2020202,0]},
  {name:'behind',data:triangle([[-.8,-.8,2],[.8,-.8,2],[0,.8,2]],green),
    matrix:[1.2,0,0,0,0,1.2,0,0,0,0,-1.020202,-1,0,0,-.2020202,0]}
].map(f=>({...f,matrix:f.matrix??identity}));
function rasterOracle(projected,x,y){
  let color=[5,10,20],nearest=Infinity,safe=true;
  for(let i=0;i<projected.length;i+=21){
    const vertices=[0,7,14].map(j=>projected.slice(i+j,i+j+7));
    if(vertices.every(v=>v[3]<=0))continue;
    assert.ok(vertices.every(v=>v[3]>0),'fixture requires positive homogeneous W');
    const [a,b,c]=vertices.map(v=>[v[0]/v[3],v[1]/v[3],v[2]/v[3]]);
    const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;
    const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,w=1-u-v;
    const min=Math.min(u,v,w),z=u*a[2]+v*b[2]+w*c[2];
    if(min>-.04&&min<.04)safe=false;
    if(min>=0&&Math.abs(Math.abs(z)-1)<.025)safe=false;
    if(min>=0&&z>=-1&&z<=1&&z<nearest){nearest=z;color=vertices[0].slice(4).map(n=>Math.round(n*255));}
  }
  return safe?color:null;
}
export async function checkRendererParity(page){
  const python=spawnSync('python3',['scripts/drone_003_oracle.py'],{input:JSON.stringify({projections:fixtures}),encoding:'utf8',timeout:20000});
  assert.equal(python.status,0,python.stderr||String(python.error));
  const expected=JSON.parse(python.stdout).projections;
  const result=await page.evaluate(async fixtures=>{
    const {OptionalRenderer}=await import('/engine/render-optional/index.js');
    const {Backend}=await import('/engine/render-optional/webgpu.js');
    if(!navigator.gpu)throw Error('WebGPU missing: parity cannot be skipped');
    const adapter=await navigator.gpu.requestAdapter({forceFallbackAdapter:true});
    if(!adapter)throw Error('Software WebGPU adapter unavailable: parity cannot be skipped');
    const info=adapter.info;
    if(!adapter.isFallbackAdapter&&!info?.isFallbackAdapter&&!/swiftshader|software/i.test((info?.description??'')+' '+(info?.device??'')))
      throw Error('Refusing a physical GPU in the software parity test');
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const host=document.createElement('div');host.style.position='relative';host.append(canvas);document.body.append(host);
    const cpu=new OptionalRenderer(canvas),gpu=await Backend.create(canvas,adapter,()=>cpu.useCPU());
    const device=gpu.device,errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
    // Headless software adapters need no desktop swapchain. Use a real GPU
    // texture as the attachment, keeping the production shader, WASM, buffers,
    // depth test and command submission unchanged. This is offscreen evidence.
    const nativeContext=gpu.context;
    const target=device.createTexture({size:[128,128],format:gpu.format,
      usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
    gpu.context={getCurrentTexture:()=>target,unconfigure:()=>nativeContext.unconfigure()};
    const checks=[];
    for(const fixture of fixtures){
      const handle=cpu.createMesh(fixture.data),matrix=Float32Array.from(fixture.matrix),mesh=cpu.meshes.get(handle);
      cpu.beginFrame({vp:matrix});cpu.draw(handle);cpu.endFrame();
      const cpuPixels=Array.from(canvas.getContext('2d').getImageData(0,0,128,128).data);
      gpu.render([mesh],matrix,0);
      const projected=Array.from(new Float32Array(gpu.wasm.memory.buffer,4194304,mesh.data.length/6*7));
      const buffer=device.createBuffer({size:128*128*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      const encoder=device.createCommandEncoder();
      encoder.copyTextureToBuffer({texture:gpu.context.getCurrentTexture()},{buffer,bytesPerRow:512},{width:128,height:128});
      device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);
      const gpuPixels=Array.from(new Uint8Array(buffer.getMappedRange()));buffer.unmap();buffer.destroy();
      if(gpu.format.startsWith('bgra'))for(let i=0;i<gpuPixels.length;i+=4)[gpuPixels[i],gpuPixels[i+2]]=[gpuPixels[i+2],gpuPixels[i]];
      checks.push({name:fixture.name,projected,cpuPixels,gpuPixels});gpu.release(mesh);cpu.deleteMesh(handle);
    }
    const {RaceRenderer}=await import('/src/scene.js');
    const {createSession,stepSession}=await import('/src/game.js');
    const {compilePack}=await import('/src/mods.js');
    const {PRESETS}=await import('/src/courses.js');
    const {SoundEventLog}=await import('/src/audio.js');
    const scene=new RaceRenderer(canvas),track=compilePack(PRESETS.neon).track;
    const visible=createSession(track),reference=createSession(track),aLog=new SoundEventLog(),bLog=new SoundEventLog();
    visible.camera='chase';scene.renderer.gpu=gpu;
    for(let tick=0;tick<36;tick++){
      const command={thrust:[0,0,-1],turn:[0,.1,0]};
      stepSession(visible,command);stepSession(reference,command);aLog.append(visible);bLog.append(reference);
      scene.draw(visible,tick*34);
      if(JSON.stringify([visible.body,visible.race,aLog.export()])!==JSON.stringify([reference.body,reference.race,bLog.export()]))
        throw Error('WebGPU game rendering mutated race authority or sound events');
    }
    await device.queue.onSubmittedWorkDone();
    const sceneFrames=scene.stats().frames;scene.renderer.gpu=null;scene.dispose();
    target.destroy();cpu.gpu=gpu;device.destroy();await device.lost;await new Promise(r=>setTimeout(r,0));
    const fallback=cpu.mode;cpu.dispose();host.remove();
    return {checks,errors,fallback,sceneFrames,adapter:{description:info?.description,vendor:info?.vendor,device:info?.device,
      fallback:adapter.isFallbackAdapter??info?.isFallbackAdapter??true},width:128};
  },fixtures);
  assert.deepEqual(result.errors,[]);assert.equal(result.fallback,'cpu','device loss must restore CPU');
  const summary=[];
  for(let f=0;f<result.checks.length;f++){
    const row=result.checks[f];assert.deepEqual(row.projected,expected[f],row.name+' production WASM vs independent binary32 oracle');
    let different=0,checked=0,maxInteriorError=0;
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const i=(y*128+x)*4;
      if([0,1,2].some(k=>Math.abs(row.cpuPixels[i+k]-row.gpuPixels[i+k])>8))different++;
      const reference=rasterOracle(expected[f],(x+.5)/64-1,1-(y+.5)/64);
      if(reference){
        checked++;
        for(let k=0;k<3;k++){
          const error=Math.abs(row.gpuPixels[i+k]-reference[k]);maxInteriorError=Math.max(maxInteriorError,error);
          assert.ok(error<=2,row.name+' GPU/scalar raster mismatch at '+x+','+y+' channel '+k+': '+error);
          assert.ok(Math.abs(row.cpuPixels[i+k]-reference[k])<=2,row.name+' CPU/scalar raster mismatch');
        }
      }
    }
    assert.ok(checked>10000,'independent interior/background coverage');
    assert.ok(different/(128*128)<.04,row.name+' CPU/GPU pixel coverage disagreement');
    summary.push({name:row.name,numerical:'bit-exact',independentPixels:checked,maxInteriorError,
      edgeMismatchFraction:different/(128*128)});
  }
  assert.equal(result.sceneFrames,36);
  return {adapter:result.adapter,deviceLossFallback:result.fallback,gameSceneFrames:result.sceneFrames,
    raceAndSoundNoninterference:'PASS',fixtures:summary};
}
