// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
test('HTML uses local ES modules and exposes start control',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="restart"/);
  assert.match(html,/src="\.\/src\/main\.js"/);
  assert.doesNotMatch(html,/<script[^>]+src="https?:/);
  assert.match(html,/INDEPENDENCE/i);
});
test('vendored engine and docs are present; no runtime package dependencies',async()=>{
  for(const p of ['engine/math/index.js','engine/collision/index.js','engine/flight/index.js',
    'engine/time/index.js','ROADMAP.md','docs/ARCHITECTURE.md','docs/HOW_TO_PLAY.md','docs/VERIFICATION.md'])
    await access(new URL('../'+p,import.meta.url));
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
  assert.deepEqual(pkg.dependencies??{},{});
});


test('build cannot overwrite repository metadata, sources or unowned directories',async()=>{
  const {mkdtemp,mkdir,writeFile,readFile,cp,rm,symlink}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {spawnSync}=await import('node:child_process');
  const dir=await mkdtemp(join(tmpdir(),'drone-build-safety-'));
  const script=new URL('../scripts/site.mjs',import.meta.url);
  const run=(...args)=>spawnSync(process.execPath,[join(dir,'scripts/site.mjs'),...args],
    {cwd:dir,encoding:'utf8'});
  try{
    for(const p of ['scripts','src','engine','docs/assets','.git'])
      await mkdir(join(dir,p),{recursive:true});
    await cp(script,join(dir,'scripts/site.mjs'));
    await writeFile(join(dir,'.git/config'),'git-metadata-sentinel\n');
    await writeFile(join(dir,'src/sim.js'),'game-source-sentinel\n');
    await writeFile(join(dir,'engine/math.js'),'engine-source-sentinel\n');
    for(const target of ['.git','src','engine','docs','docs/assets','scripts',
      'src/inner','_site/../.git','../other','.github']){
      const result=run('build',target);
      assert.notEqual(result.status,0,'must reject '+target);
    }
    assert.equal(await readFile(join(dir,'.git/config'),'utf8'),'git-metadata-sentinel\n');
    assert.equal(await readFile(join(dir,'src/sim.js'),'utf8'),'game-source-sentinel\n');
    assert.equal(await readFile(join(dir,'engine/math.js'),'utf8'),'engine-source-sentinel\n');
    await mkdir(join(dir,'_site'));
    await writeFile(join(dir,'_site/my-data.txt'),'keep-this\n');
    assert.notEqual(run('build','_site').status,0,'never delete an unowned _site');
    assert.equal(await readFile(join(dir,'_site/my-data.txt'),'utf8'),'keep-this\n');
    await rm(join(dir,'_site'),{recursive:true});
    await symlink(join(dir,'.git'),join(dir,'_site'),'dir');
    assert.notEqual(run('build','_site').status,0,'reject symlink output');
    assert.equal(await readFile(join(dir,'.git/config'),'utf8'),'git-metadata-sentinel\n');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('fresh _site build may be safely rebuilt only when its previous inventory matches',async()=>{
  const {mkdtemp,mkdir,writeFile,readFile,cp,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {spawnSync}=await import('node:child_process');
  const dir=await mkdtemp(join(tmpdir(),'drone-build-rebuild-'));
  const run=(...args)=>spawnSync(process.execPath,[join(dir,'scripts/site.mjs'),...args],
    {cwd:dir,encoding:'utf8'});
  try{
    for(const p of ['scripts','src','engine','docs/assets'])
      await mkdir(join(dir,p),{recursive:true});
    await cp(new URL('../scripts/site.mjs',import.meta.url),join(dir,'scripts/site.mjs'));
    for(const p of ['index.html','styles.css','src/app.js','engine/index.js',
       'docs/assets/banner.svg'])await writeFile(join(dir,p),'safe local asset '+p+'\n');
    assert.equal(run('build','_site').status,0,'first build must succeed');
    assert.equal(run('verify','_site').status,0);
    assert.equal(run('build','_site').status,0,'verified existing build can be replaced');
    await writeFile(join(dir,'_site/unrelated.txt'),'keep me\n');
    assert.notEqual(run('build','_site').status,0,'extra files must prevent deletion');
    assert.equal(await readFile(join(dir,'_site/unrelated.txt'),'utf8'),'keep me\n');
  }finally{await rm(dir,{recursive:true,force:true});}
});
