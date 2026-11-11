// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the actual browser module with a deterministic RAF/clock and Canvas
// recording stub; never substitute a reimplementation of the pause handlers.
async function withGame(label,run){
  const names=['document','window','localStorage','ResizeObserver',
    'requestAnimationFrame','devicePixelRatio','performance'];
  const originals=Object.fromEntries(names.map(n=>[n,globalThis[n]]));
  const handlers=new Map();
  const nodes=new Map();
  let now=0,raf=null;
  const context={
    createLinearGradient:()=>({addColorStop(){}}),
    createRadialGradient:()=>({addColorStop(){}}),
    fillRect(){},save(){},restore(){},fillText(){},arc(){},
    createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData(){},
    beginPath(){},moveTo(){},lineTo(){},stroke(){},closePath(){},fill(){}
  };
  function element(){
    const local=new Map();
    return {textContent:'',hidden:false,disabled:false,
      clientWidth:960,clientHeight:540,width:960,
      getContext:()=>context,
      addEventListener(name,fn){local.set(name,fn);},
      fire(name,...args){assert.ok(local.has(name),'missing event '+name);local.get(name)(...args);}};
  }
  for(const id of ['#flight','#hud','#notice','#restart','#pause',
      '#mode','#overlay','#restart-inline'])nodes.set(id,element());
  try{
    globalThis.document={querySelector:id=>nodes.get(id),querySelectorAll:()=>[],
      addEventListener(name,fn){handlers.set(name,fn);}};
    globalThis.window={addEventListener(){}};
    globalThis.localStorage={getItem:()=>null,setItem(){}};
    globalThis.ResizeObserver=class{observe(){}};
    globalThis.performance={now:()=>now};
    globalThis.requestAnimationFrame=fn=>{raf=fn;return 1;};
    globalThis.devicePixelRatio=1;
    await import('../src/main.js?test='+label);
    const advance=ms=>{
      now+=ms;
      assert.equal(typeof raf,'function','missing RAF callback');
      const cb=raf;raf=null;cb(now);
    };
    await run({nodes,handlers,advance,skip:ms=>{now+=ms;}});
  }finally{
    for(const [name,value] of Object.entries(originals)){
      if(value===undefined)delete globalThis[name];
      else globalThis[name]=value;
    }
  }
}

test('Pause button, P key and focus loss cannot start hidden race',async()=>{
  await withGame('pre-start',({nodes,handlers,advance})=>{
    const overlay=nodes.get('#overlay'),pause=nodes.get('#pause'),hud=nodes.get('#hud');
    assert.equal(overlay.hidden,false);
    assert.equal(pause.disabled,true);
    pause.fire('click');
    handlers.get('keydown')({code:'KeyP',repeat:false});
    advance(100);
    assert.equal(overlay.hidden,false,'start overlay must remain');
    assert.match(hud.textContent,/0\.00s/,'no simulation ticks before Start');
    assert.equal(pause.textContent,'','pause label must not become Resume');
    nodes.get('#restart').fire('click');
    assert.equal(overlay.hidden,true,'Start must dismiss overlay');
    assert.equal(pause.disabled,false);
    advance(100);
    assert.match(hud.textContent,/0\.10s/);
  });
});

test('resuming after long suspended animation excludes paused wall time',async()=>{
  await withGame('pause-gap',({nodes,advance,skip})=>{
    nodes.get('#restart').fire('click');
    advance(100);
    assert.match(nodes.get('#hud').textContent,/0\.10s/);
    nodes.get('#pause').fire('click');
    assert.equal(nodes.get('#notice').textContent,'PAUSED — PRESS RESUME');
    skip(10_000);
    nodes.get('#pause').fire('click');
    assert.equal(nodes.get('#notice').textContent,'FLY THROUGH EACH GATE IN ORDER');
    advance(0);
    assert.match(nodes.get('#hud').textContent,/0\.10s/,
      'first frame must not advance paused time');
    advance(100);
    assert.match(nodes.get('#hud').textContent,/0\.20s/,
      'only elapsed running time may increment the race clock');
  });
});

test('keyboard resume also discards suspended time',async()=>{
  await withGame('keyboard-gap',({nodes,handlers,advance,skip})=>{
    nodes.get('#restart').fire('click');
    advance(100);
    handlers.get('keydown')({code:'KeyP',repeat:false});
    skip(5000);
    handlers.get('keydown')({code:'KeyP',repeat:false});
    advance(0);
    assert.match(nodes.get('#hud').textContent,/0\.10s/);
  });
});


test('focused select and text inputs preserve native keyboard input and never fly',async()=>{
  await withGame('focused-controls',({nodes,handlers,advance})=>{
    nodes.get('#restart').fire('click');
    advance(100);
    const hud=nodes.get('#hud');
    assert.match(hud.textContent,/0\.10s/);
    const control={closest(selector){
      assert.match(selector,/select/);
      return this;
    }};
    const focus=handlers.get('focusin');
    assert.equal(typeof focus,'function','focus handler must cancel held flight inputs');
    focus({target:control});
    for(const code of ['ArrowDown','ArrowUp','ArrowLeft','ArrowRight',
      'Space','KeyR','KeyM','KeyT','KeyP']){
      let prevented=false;
      handlers.get('keydown')({code,repeat:false,target:control,
        preventDefault(){prevented=true;}});
      assert.equal(prevented,false,code+' native control behavior must remain intact');
    }
    advance(100);
    assert.match(hud.textContent,/0\.20s/,'R and P must not reset or pause the race');
    assert.match(hud.textContent,/ASSISTED/,'M must not change mode in a select');
    assert.match(hud.textContent,/0\.0 m\/s/,'arrow keys must not steer the drone');
  });
});
