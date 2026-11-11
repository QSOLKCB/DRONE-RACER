// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {DepthRenderer} from '../src/depth-renderer.js';
import {cameraMatrix} from '../src/scene.js';
import {createSession} from '../src/game.js';
import {rotate,quatMultiply} from '../engine/math/index.js';

function canvas(width=100,height=100){
  const ctx={fillRect(){},createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
    putImageData(image){this.image=image;}};
  return {width,height,getContext:()=>ctx};
}
const colorAt=(renderer,x,y)=>Array.from(renderer.image.data.slice((y*renderer.image.width+x)*4,(y*renderer.image.width+x)*4+3));
const red=[1,0,0],blue=[0,0,1];
const triangle=(depths,color)=>[-.9,-.9,depths[0],...color,.9,-.9,depths[1],...color,0,.9,depths[2],...color];

test('intersecting faces use per-pixel depth regardless of submission or mean-depth order',()=>{
  const renderer=new DepthRenderer(canvas());
  const tilted=renderer.createMesh(triangle([-.8,.8,.2],red));
  const flat=renderer.createMesh(triangle([0,0,0],blue));
  for(const order of [[tilted,flat],[flat,tilted]]){
    renderer.beginFrame();for(const mesh of order)renderer.draw(mesh);renderer.endFrame();
    // Whole-triangle mean depth sorts blue over the entire tilted face, hiding
    // its nearer left side. Both colors must coexist in their overlap.
    assert.deepEqual(colorAt(renderer,30,70),[255,0,0]);
    assert.deepEqual(colorAt(renderer,70,70),[0,0,255]);
  }
  renderer.dispose();
});

test('near-plane clipped faces remain visible and occlude lines behind them',()=>{
  const renderer=new DepthRenderer(canvas());
  const face=renderer.createMesh(triangle([-2,0,0],red));
  const behind=renderer.createMesh([-.6,-.4,.5,...blue,.6,-.4,.5,...blue],'lines');
  renderer.beginFrame();renderer.draw(face);renderer.draw(behind);renderer.endFrame();
  assert.deepEqual(colorAt(renderer,50,70),[255,0,0]);
  assert.deepEqual(colorAt(renderer,1,1),[5,10,20]);
  assert.ok(renderer.depth.some(Number.isFinite));
  assert.ok(renderer.depth.every(z=>z===Infinity||z>=-1&&z<=1));
});

test('GPU failure returns to depth-tested CPU in the same frame and reuses bounded buffers',()=>{
  const renderer=new DepthRenderer(canvas()),face=renderer.createMesh(triangle([0,0,0],red));
  let disposed=false;renderer.gpu={render(){throw Error('device lost');},dispose(){disposed=true;}};
  renderer.beginFrame();renderer.draw(face);renderer.endFrame();
  assert.equal(disposed,true);assert.equal(renderer.mode,'cpu');
  assert.deepEqual(colorAt(renderer,50,50),[255,0,0]);
  const image=renderer.image,depth=renderer.depth;
  renderer.beginFrame();renderer.endFrame();
  assert.equal(renderer.image,image);assert.equal(renderer.depth,depth);
  assert.deepEqual(colorAt(renderer,50,50),[5,10,20]);
  renderer.canvas.width=1921;renderer.canvas.height=1080;
  renderer.beginFrame();assert.throws(()=>renderer.endFrame(),/bounded raster/);
});

test('FPV and chase near-plane corners stay above ground under pitch, roll and inversion',()=>{
  const pitch=[Math.SQRT1_2,0,0,Math.SQRT1_2],roll=[0,0,Math.SQRT1_2,Math.SQRT1_2];
  for(const camera of ['fpv','chase'])for(const aspect of [.4,16/9,3])
  for(const orientation of [pitch,roll,[0,0,1,0],quatMultiply(pitch,roll)]){
    const s=createSession();s.camera=camera;s.body.halfSize=.1;
    s.body.position=[0,.1,-40];s.body.orientation=orientation;
    const before=structuredClone(s.body),near=.15,m=cameraMatrix(s,aspect,650);
    const right=rotate(orientation,[1,0,0]),up=rotate(orientation,[0,1,0]),back=rotate(orientation,[0,0,1]);
    // Recover the eye from the view-projection translation rather than
    // mirroring the production clamp, then check all four world-space corners.
    const f=1/Math.tan(Math.PI/5);
    const eye=right.map((r,i)=>-r*m[12]*aspect/f-up[i]*m[13]/f+back[i]*m[15]);
    for(const x of [-1,1])for(const y of [-1,1]){
      const height=eye[1]+right[1]*x*near*aspect/f+up[1]*y*near/f-back[1]*near;
      assert.ok(height>=-1e-5,`${camera} aspect ${aspect}: near-plane corner under ground`);
    }
    assert.deepEqual(s.body,before);
  }
});
