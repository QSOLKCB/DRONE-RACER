// SPDX-License-Identifier: Apache-2.0
import {mkdir,rm,cp,readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,relative,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..'),allow=['index.html','styles.css','src','engine','docs/assets'];
const digest=b=>createHash('sha256').update(b).digest('hex');
async function inventory(out){
  const result=[];
  async function walk(dir){
    for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const p=join(dir,entry.name);
      if(entry.isDirectory())await walk(p);
      else if(entry.isFile()){const bytes=await readFile(p);
        result.push({path:relative(out,p).split(sep).join('/'),bytes:bytes.length,sha256:digest(bytes)});}
      else throw new Error('non-regular asset');
    }
  }
  await walk(out);return result.sort((a,b)=>a.path.localeCompare(b.path));
}
async function main(){
  const [action,target='_site']=process.argv.slice(2);
  if(!['build','verify'].includes(action)||!target||target==='.'||target==='..'||
     !/^[a-zA-Z0-9._/-]+$/.test(target)||target.split('/').includes('..')||
     target.startsWith('/'))throw new Error('usage: node scripts/site.mjs build|verify _site');
  const out=resolve(root,target);
  if(!out.startsWith(root+sep))throw new Error('unsafe output');
  if(action==='build'){
    await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
    for(const item of allow)await cp(join(root,item),join(out,item),{recursive:true});
    const files=await inventory(out);
    await writeFile(join(out,'manifest.json'),JSON.stringify({kind:'qsol.drone-racer.offline.v1',files},null,2)+'\n');
    console.log('Built '+files.length+' assets');
  }else{
    const manifest=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));
    const actual=(await inventory(out)).filter(f=>f.path!=='manifest.json');
    if(manifest.kind!=='qsol.drone-racer.offline.v1'||JSON.stringify(manifest.files)!==JSON.stringify(actual))
      throw new Error('output inventory/digest mismatch');
    console.log('VERIFIED '+actual.length+' assets');
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
