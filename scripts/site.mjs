// SPDX-License-Identifier: Apache-2.0
import {mkdir,rm,cp,readdir,readFile,writeFile,lstat} from 'node:fs/promises';
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
  // Build removes its destination recursively: accept ONLY dedicated output
  // names under the repository root, never source, docs, .git or a child path.
  // Alternate isolated build names are useful for disposable CI fixtures.
  if(!/^_site(?:-[A-Za-z0-9_-]{1,40})?$/.test(target))
    throw new Error('unsafe output: use _site or _site-<suffix>');
  const out=resolve(root,target);
  if(action==='build'){
    // A previous output must be a genuine, complete build we own. Refuse
    // symlinks, unknown existing directories, corrupt manifests and stray files
    // BEFORE the first rm(). Never recursively delete arbitrary user data.
    let stat;
    try{stat=await lstat(out);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(stat){
      if(!stat.isDirectory()||stat.isSymbolicLink())
        throw new Error('unsafe output: existing target is not a directory');
      let marker;
      try{
        const st=await lstat(join(out,'manifest.json'));
        if(!st.isFile()||st.isSymbolicLink())throw new Error('untrusted manifest');
        marker=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));
      }catch{throw new Error('unsafe output: existing directory is not a verified site');}
      const existing=(await inventory(out)).filter(f=>f.path!=='manifest.json');
      if(marker.kind!=='qsol.drone-racer.offline.v1'||
         JSON.stringify(marker.files)!==JSON.stringify(existing))
        throw new Error('unsafe output: existing site inventory mismatch');
    }
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
