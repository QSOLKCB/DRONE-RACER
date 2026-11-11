// SPDX-License-Identifier: Apache-2.0
// Game-owned CPU depth rasterization. The source-pinned donor keeps its original
// painter implementation; retained meshes, clipping, projection and GPU stay shared.
import {OptionalRenderer,projectVertices,clipPolygon,clipLine} from '../engine/render-optional/index.js';
const sizes={triangles:3,lines:2,points:1};
const background=new Uint32Array(Uint8Array.from([5,10,20,255]).buffer)[0];
const edge=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
const byte=v=>Math.round(Math.max(0,Math.min(1,v))*255);

export class DepthRenderer extends OptionalRenderer{
  resize(){
    const w=this.canvas.width,h=this.canvas.height;
    // Matches the game's maximum backing-store size; never allocate from
    // source-owned course geometry or an unbounded offscreen projection.
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>1920*1080)
      throw new RangeError('bounded raster dimensions required');
    if(this.image?.width===w&&this.image?.height===h)return;
    this.image=this.ctx.createImageData(w,h);
    this.pixels=new Uint32Array(this.image.data.buffer);
    this.depth=new Float64Array(w*h);
  }
  screen(v){
    const q=1/v[3];
    return [(v[0]*q+1)*this.image.width/2,(1-v[1]*q)*this.image.height/2,
      v[2]*q,q,v[4]*q,v[5]*q,v[6]*q];
  }
  triangle(a,b,c){
    let area=edge(a,b,c[0],c[1]);
    if(Math.abs(area)<1e-12)return;
    if(area<0){[b,c]=[c,b];area=-area;}
    const w=this.image.width,h=this.image.height,data=this.image.data,depth=this.depth;
    const x0=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])-.5));
    const x1=Math.min(w-1,Math.floor(Math.max(a[0],b[0],c[0])-.5));
    const y0=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])-.5));
    const y1=Math.min(h-1,Math.floor(Math.max(a[1],b[1],c[1])-.5));
    const ax=b[1]-c[1],bx=c[1]-a[1],cx=a[1]-b[1];
    const ay=c[0]-b[0],by=a[0]-c[0],cy=b[0]-a[0];
    let rowA=edge(b,c,x0+.5,y0+.5),rowB=edge(c,a,x0+.5,y0+.5),rowC=edge(a,b,x0+.5,y0+.5);
    const inv=1/area;
    for(let y=y0;y<=y1;y++,rowA+=ay,rowB+=by,rowC+=cy){
      let ea=rowA,eb=rowB,ec=rowC,index=y*w+x0;
      for(let x=x0;x<=x1;x++,index++,ea+=ax,eb+=bx,ec+=cx){
        if(ea<0||eb<0||ec<0)continue;
        const u=ea*inv,v=eb*inv,t=ec*inv,z=u*a[2]+v*b[2]+t*c[2];
        if(z>depth[index])continue;
        depth[index]=z;
        const q=1/(u*a[3]+v*b[3]+t*c[3]),i=index*4;
        data[i]=byte((u*a[4]+v*b[4]+t*c[4])*q);
        data[i+1]=byte((u*a[5]+v*b[5]+t*c[5])*q);
        data[i+2]=byte((u*a[6]+v*b[6]+t*c[6])*q);
      }
    }
  }
  line(a,b){
    const w=this.image.width,h=this.image.height,dx=b[0]-a[0],dy=b[1]-a[1];
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))));
    for(let j=0;j<=steps;j++){
      const t=j/steps,s=1-t,x=Math.floor(a[0]+dx*t),y=Math.floor(a[1]+dy*t);
      if(x<0||y<0||x>=w||y>=h)continue;
      const index=y*w+x,z=s*a[2]+t*b[2];
      if(z>this.depth[index])continue;
      this.depth[index]=z;
      const q=1/(s*a[3]+t*b[3]),i=index*4,data=this.image.data;
      for(let k=0;k<3;k++)data[i+k]=byte((s*a[k+4]+t*b[k+4])*q);
    }
  }
  endFrame(){
    if(!this.active)throw new Error('beginFrame required');
    this.active=false;
    if(this.gpu){
      try{this.gpu.render(this.primitives,this.vp,this.fog);this.calls.frames++;return;}
      catch{this.useCPU();}
    }
    this.resize();this.pixels.fill(background);this.depth.fill(Infinity);
    for(const mesh of this.primitives){
      const p=projectVertices(mesh.data,this.vp,mesh.projected),size=sizes[mesh.mode];
      // Match the GPU's per-vertex fog before homogeneous clipping; attributes
      // are perspective-correct after clipping, while screen depth is linear.
      if(this.fog)for(let i=0;i<p.length;i+=7){
        const k=Math.exp(-Math.max(0,p[i+3])*this.fog);
        for(let j=4;j<7;j++)p[i+j]*=k;
      }
      for(let i=0;i<p.length;i+=size*7){
        const original=Array.from({length:size},(_,j)=>Array.from(p.subarray(i+j*7,i+j*7+7)));
        const poly=size===2?clipLine(...original):clipPolygon(original);
        if(poly.length<size)continue;
        const vertices=poly.map(v=>this.screen(v));
        if(size===2)this.line(vertices[0],vertices.at(-1));
        else if(size===1)this.line(vertices[0],vertices[0]);
        else for(let j=1;j<vertices.length-1;j++)this.triangle(vertices[0],vertices[j],vertices[j+1]);
      }
    }
    this.ctx.putImageData(this.image,0,0);this.calls.frames++;
  }
  dispose(){super.dispose();this.image=null;this.pixels=null;this.depth=null;}
}
