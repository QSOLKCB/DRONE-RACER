// SPDX-License-Identifier: Apache-2.0
// Cardinal X/Z gate planes: exact decimal admission and widened integer sweeps.
import {parseDecimal} from '../engine/exact-rational/index.js';
import {quantizeQ16} from '../engine/rational-q16/index.js';
import {record, list, label, identifier, color, freeze} from './data.js';
import {pointToRawQ16} from './position-q16.js';
import {groundBounds} from './ground.js';
const SCALE = 65536;
const q = s => {
  if (typeof s !== 'string' || s.length > 24) throw new TypeError('bounded decimal string required');
  const raw = quantizeQ16(parseDecimal(s), {rounding:'exact', overflow:'reject'});
  if (Math.abs(raw) > 4096 * SCALE) throw new RangeError('circuit coordinate exceeds 4096m');
  return raw;
};
const point = v => list(v, 3, 3).map(q);
const metres = v => v.map(n => n / SCALE);
export function compileCircuit(source, title) {
  const s = record(source, ['id', 'version', 'laps', 'spawn', 'gates', 'obstacles']);
  identifier(s.id); label(title, 80);
  if (s.version !== 2 || !Number.isInteger(s.laps) || s.laps < 1 || s.laps > 9)
    throw new RangeError('circuit version 2 and 1..9 laps required');
  const spawn = metres(point(s.spawn));
  const ids = new Set();
  const gates = list(s.gates, 4, 64).map(raw => {
    const g = record(raw, ['id', 'x', 'y', 'z', 'width', 'height', 'axis', 'direction']);
    identifier(g.id);
    if (ids.has(g.id)) throw new TypeError('duplicate gate ID');
    ids.add(g.id);
    if (!['x', 'z'].includes(g.axis) || ![-1, 1].includes(g.direction)) throw new TypeError('cardinal gate direction required');
    const p = [q(g.x), q(g.y), q(g.z)], w = q(g.width), h = q(g.height);
    if (w < 4*SCALE || w > 60*SCALE || h < 4*SCALE || h > 60*SCALE ||
        w % 2 || h % 2 || p[1] - h/2 < 0) throw new RangeError('invalid aperture or below-ground gate');
    const axis = g.axis === 'x' ? 0 : 2, side = axis === 0 ? 2 : 0;
    return {id:g.id, x:p[0]/SCALE, y:p[1]/SCALE, z:p[2]/SCALE,
      width:w/SCALE, height:h/SCALE, axis:g.axis, direction:g.direction,
      raw:{plane:p[axis], side:p[side], bottom:p[1]-h/2, top:p[1]+h/2, halfWidth:w/2}};
  });
  const obstacles = list(s.obstacles, 0, 96).map(raw => {
    const o = record(raw, ['id', 'min', 'max', 'color']); identifier(o.id); color(o.color);
    if (ids.has(o.id)) throw new TypeError('duplicate obstacle ID'); ids.add(o.id);
    const min = metres(point(o.min)), max = metres(point(o.max));
    if (min.some((n, i) => n >= max[i]) || min[1] < 0) throw new RangeError('invalid obstacle volume');
    return {id:o.id, min, max, color:o.color};
  });
  // Physical gate beams share the renderer's aperture dimensions. Existing v1
  // sprints deliberately keep their historical non-solid checkpoint semantics.
  const boxes = [...obstacles];
  for (const g of gates) {
    const a = g.axis === 'x' ? 0 : 2, u = a === 0 ? 2 : 0, p = [g.x,g.y,g.z];
    const beam = (lo, hi, bottom, top) => {
      const min = [...p], max = [...p]; min[a] -= .4; max[a] += .4;
      min[u] += lo; max[u] += hi; min[1] = bottom; max[1] = top;
      boxes.push({min, max});
    };
    const l = g.width/2, b = g.y-g.height/2, t = g.y+g.height/2;
    beam(-l-.6,-l,b-.6,t+.6); beam(l,l+.6,b-.6,t+.6);
    beam(-l,l,b-.6,b); beam(-l,l,t,t+.6);
  }
  const coords = gates.map(g => [g.x,g.y,g.z]);
  const bounds = groundBounds(gates,spawn,obstacles);
  boxes.push(bounds);
  if (boxes.some(b => spawn.every((n,i)=>n>b.min[i]-1.5 && n<b.max[i]+1.5)))
    throw new RangeError('spawn intersects a solid');
  const length = coords.reduce((sum,p,i) => sum+Math.hypot(...p.map((n,j)=>n-coords[(i+coords.length-1)%coords.length][j])),0);
  return freeze({id:s.id,version:2,title,laps:s.laps,spawn,gates,obstacles,boxes,bounds,length});
}
// Return an exact sweep fraction; caller enforces chronological gate order.
export function circuitCrossing(g, from, to) {
  const a = g.axis === 'x' ? 0 : 2, u = a === 0 ? 2 : 0, d = BigInt(g.direction);
  const f = from.map(BigInt), t = to.map(BigInt), plane = BigInt(g.raw.plane);
  const before = (plane-f[a])*d, travel = (t[a]-f[a])*d;
  if (before <= 0n || travel < before) return null;
  const lateral = f[u]*travel+(t[u]-f[u])*before, y = f[1]*travel+(t[1]-f[1])*before;
  if (lateral < BigInt(g.raw.side-g.raw.halfWidth)*travel || lateral > BigInt(g.raw.side+g.raw.halfWidth)*travel ||
      y < BigInt(g.raw.bottom)*travel || y > BigInt(g.raw.top)*travel) return null;
  return {n:before,d:travel};
}
export function advanceCircuit(race, from, to, track) {
  const a = pointToRawQ16(from), b = pointToRawQ16(to);
  let nextGate = race.nextGate, previous = {n:0n,d:1n}, crossed = 0;
  let laps=0,finished=false;const events=[];
  // A straight segment can cross a given plane only once in its direction.
  // Continue across the lap boundary with the SAME previous fraction, never
  // restart the sweep or consume simultaneous/coincident checkpoints twice.
  while (crossed <= track.gates.length) {
    const hit = circuitCrossing(track.gates[nextGate], a, b);
    if (!hit || hit.n*previous.d <= previous.n*hit.d) break;
    previous = hit; nextGate++; crossed++;
    events.push({type:'gate',index:race.clearedGates+crossed});
    if(nextGate===track.gates.length){
      laps++;
      events.push({type:race.completedLaps+laps===track.laps?'finish':'lap',index:race.completedLaps+laps});
      if(race.completedLaps+laps===track.laps){finished=true;break;}
      nextGate=0;
    }
  }
  return {nextGate,crossed,finished,lapCompleted:laps>0,events};
}
