// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {drawScene} from '../src/render.js';
import {TRACK} from '../src/track.js';
function recordingCanvas(){
  const strokes=[];
  let path=[];
  const ctx={
    createLinearGradient:()=>({addColorStop(){}}),
    createRadialGradient:()=>({addColorStop(){}}),
    fillRect(){},save(){},restore(){},fillText(){},arc(){},
    beginPath(){path=[];},
    moveTo(x,y){path.push([x,y]);},
    lineTo(x,y){path.push([x,y]);},
    stroke(){strokes.push({color:this.strokeStyle,points:path.map(p=>[...p])});}
  };
  return {canvas:{width:960,height:540,getContext:()=>ctx},strokes};
}
function drawAt(position,orientation){
  const output=recordingCanvas();
  drawScene(output.canvas,{
    body:{position,orientation},
    track:{gates:[TRACK.gates[0]]},
    race:{nextGate:0}
  });
  return output.strokes.filter(s=>s.color==='#59ffdd');
}
test('active gate survives partial near-plane clipping during 45-degree yaw',()=>{
  const yaw=Math.PI/8;
  const strokes=drawAt([0,3,-24],[0,Math.sin(yaw),0,Math.cos(yaw)]);
  assert.ok(strokes.length>0,'visible gate edges must not disappear with rear corners');
  assert.ok(strokes.some(s=>s.points.some(([x,y])=>
    Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=960&&y>=0&&y<=540)),
  'a clipped active-gate stroke must remain inside the visible viewport');
});
test('fully behind gate is rejected, fully visible gate keeps its four edges',()=>{
  assert.equal(drawAt([0,3,-50],[0,0,0,1]).length,0);
  assert.equal(drawAt([0,3,5],[0,0,0,1]).length,4);
});
