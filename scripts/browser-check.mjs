// SPDX-License-Identifier: Apache-2.0
// Packaged-site QA. Tooling is external; no physical GPU is requested.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {checkRendererParity} from './renderer-parity.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('_site');
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path!==root&&!path.startsWith(root+sep))throw Error('outside site');
    const file=path===root?resolve(root,'index.html'):path;
    const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
    args:['--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#hud').textContent.includes('LAP 1/3'));
  await page.waitForFunction(()=>{
    const c=document.querySelector('#flight'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let lit=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>150)lit++;
    return lit>100;
  });
  assert.equal(await page.locator('#pause').isDisabled(),true);
  await page.locator('#restart').click();await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.keyboard.up('KeyW');
  await page.locator('#pause').click();const paused=await page.locator('#hud').textContent();
  await page.waitForTimeout(200);assert.equal(await page.locator('#hud').textContent(),paused);
  await page.locator('#view-mode').click();await page.locator('#skin-select').selectOption('manta');
  await page.locator('#settings').evaluate(el=>el.open=true);
  await page.locator('#quality').selectOption('eco');
  await page.locator('#backend').selectOption('gpu');
  await page.waitForFunction(()=>document.querySelector('#backend-status').textContent.includes('fallback'));
  await page.locator('#quality').selectOption('high');
  await page.locator('#settings').evaluate(el=>el.open=false);
  await page.screenshot({path:process.env.DRONE_SCREENSHOT||'/tmp/drone-racer-desktop.png',fullPage:true});
  await page.locator('#skin-upload').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"kind":"evil"}')});
  assert.match(await page.locator('#skin-status').textContent(),/REJECTED/);
  assert.equal(await page.locator('#skin-name').textContent(),'Tidal Manta');
  const skinPack=JSON.parse(await readFile('mods/skins/independence-hangar.json','utf8'));
  skinPack.skins[0].name='Copper Custom';skinPack.skins[0].colors.body='#cc7733';
  await page.locator('#skin-upload').setInputFiles({name:'copper.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(skinPack))});
  await page.waitForFunction(()=>document.querySelector('#skin-name').textContent==='Copper Custom');
  assert.match(await page.locator('#hud').textContent(),/LAP 1\/3/,'cosmetics must not restart or change the course');
  await page.locator('#pack-select').selectOption('foundry');
  await page.waitForFunction(()=>document.querySelector('#hud').textContent.includes('LAP 1/2'));
  assert.match(await page.locator('#hud').textContent(),/GATE 1\/25/);
  await page.locator('#sound').click();await page.waitForFunction(()=>document.querySelector('#sound').textContent==='Sound: On');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.match(await page.locator('#notice').textContent(),/PAUSED/);
  const download=page.waitForEvent('download');await page.locator('#pack-export').click();
  const file=await download;const exported=JSON.parse(await readFile(await file.path(),'utf8'));
  assert.equal(exported.id,'foundry-run');assert.equal(exported.course.laps,2);
  const custom={...exported,id:'custom-foundry',title:'Custom Foundry'};
  await page.locator('#pack-upload').setInputFiles({name:'custom.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(custom))});
  await page.waitForFunction(()=>document.querySelector('#pack-status').textContent.includes('Custom Foundry'));
  const customDownload=page.waitForEvent('download');await page.locator('#pack-export').click();
  assert.deepEqual(JSON.parse(await readFile(await (await customDownload).path(),'utf8')),custom,'export must retain imported source');
  await page.locator('#pack-upload').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...custom,script:'bad'}))});
  await page.waitForFunction(()=>document.querySelector('#pack-status').textContent.includes('REJECTED'));
  assert.equal(await page.locator('#pack-title').textContent(),'CUSTOM FOUNDRY');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#hud').textContent.includes('LAP 1/3'));
  assert.equal(await page.locator('#view-mode').textContent(),'View: Chase');
  assert.equal(await page.locator('#sound').textContent(),'Sound: Off');
  assert.equal(await page.locator('#backend').inputValue(),'cpu');
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(origin);
  await mobile.waitForFunction(()=>document.querySelector('#hud').textContent.includes('LAP 1/3'));
  assert.equal(await mobile.locator('.touch').isVisible(),true);
  await mobile.locator('#restart').tap();
  const box=await mobile.locator('[data-control="KeyW"]').boundingBox(),cdp=await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
  await mobile.waitForTimeout(200);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.locator('#pause').tap();
  assert.doesNotMatch(await mobile.locator('#hud').textContent(),/ · 0\.0 m\/s/,'held touch thrust must move the drone');
  await mobile.screenshot({path:'/tmp/drone-racer-mobile.png',fullPage:true});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile layout overflows');
  await mobile.close();
  assert.deepEqual(errors,[]);
  const parity=await checkRendererParity(page);
  const report={browser:await browser.version(),ui:'PASS',errors,parity};
  if(process.env.DRONE_BROWSER_REPORT)await writeFile(process.env.DRONE_BROWSER_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
