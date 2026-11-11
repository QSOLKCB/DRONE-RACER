// SPDX-License-Identifier: Apache-2.0
// One ground slab for both collision and rendering. Inputs are compiled course
// geometry, never unvalidated authoring records.
export function groundBounds(gates,spawn,obstacles=[]){
  const xs=[spawn[0],...gates.map(g=>g.x)],zs=[spawn[2],...gates.map(g=>g.z)];
  for(const o of obstacles){xs.push(o.min[0],o.max[0]);zs.push(o.min[2],o.max[2]);}
  return Object.freeze({
    min:Object.freeze([Math.min(...xs)-65,-2,Math.min(...zs)-65]),
    max:Object.freeze([Math.max(...xs)+65,0,Math.max(...zs)+65])
  });
}
