// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
test('pause followed by resume clears stale paused notice in actual main module',async()=>{
  const originals={document:globalThis.document,window:globalThis.window,
    localStorage:globalThis.localStorage,ResizeObserver:globalThis.ResizeObserver,
    requestAnimationFrame:globalThis.requestAnimationFrame};
  function element(){
    const handlers=new Map();
    return {textContent:'',hidden:false,clientWidth:960,clientHeight:540,
      addEventListener(type,fn){handlers.set(type,fn);},
      fire(type){assert.ok(handlers.has(type),type);handlers.get(type)();}};
  }
  const nodes=new Map(['#flight','#hud','#notice','#restart','#pause',
    '#mode','#overlay','#restart-inline'].map(id=>[id,element()]));
  try{
    globalThis.document={querySelector:id=>nodes.get(id),
      querySelectorAll:()=>[],addEventListener(){}};
    globalThis.window={addEventListener(){}};
    globalThis.localStorage={getItem:()=>null,setItem(){}};
    globalThis.ResizeObserver=class{observe(){}};
    globalThis.requestAnimationFrame=()=>0;
    await import('../src/main.js?test=resume-notice');
    nodes.get('#restart').fire('click');
    assert.equal(nodes.get('#notice').textContent,'FLY THROUGH EACH GATE IN ORDER');
    nodes.get('#pause').fire('click');
    assert.equal(nodes.get('#notice').textContent,'PAUSED — PRESS RESUME');
    nodes.get('#pause').fire('click');
    assert.equal(nodes.get('#notice').textContent,'FLY THROUGH EACH GATE IN ORDER');
    assert.equal(nodes.get('#pause').textContent,'Pause');
  }finally{
    for(const [key,value] of Object.entries(originals)){
      if(value===undefined)delete globalThis[key];else globalThis[key]=value;
    }
  }
});
