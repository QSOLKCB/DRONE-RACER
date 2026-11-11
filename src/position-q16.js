// SPDX-License-Identifier: Apache-2.0
// Explicit Float64 flight position -> signed Q16.16 raw boundary.
// Conversion uses the exact IEEE-754 binary64 value and truncates toward zero;
// it is NOT a proof of bit-identical floating-point flight across browsers.
import {INT_MIN,INT_MAX} from '../engine/integer-math/index.js';
const MAX_MANTISSA=(1n<<52n)-1n;
const buffer=new ArrayBuffer(8);
const bits=new DataView(buffer);

/** Exact truncation of the represented Float64 x * 65536. */
export function positionToRawQ16(value){
  if(typeof value!=='number'||!Number.isFinite(value))
    throw new TypeError('finite Float64 position required');
  bits.setFloat64(0,value,false);
  const ieee=bits.getBigUint64(0,false);
  const sign=(ieee>>63n)===0n?1n:-1n;
  const exponent=Number((ieee>>52n)&2047n);
  let mantissa=ieee&MAX_MANTISSA;
  if(exponent===0&&mantissa===0n)return 0;
  const power=exponent===0?-1022:exponent-1023;
  if(exponent!==0)mantissa+=1n<<52n;
  const shift=power-52+16;
  const magnitude=shift>=0?mantissa<<BigInt(shift):mantissa>>BigInt(-shift);
  const raw=sign*magnitude;
  if(raw<BigInt(INT_MIN)||raw>BigInt(INT_MAX))
    throw new RangeError('flight position outside signed Q16.16');
  return Number(raw)||0;
}
export function pointToRawQ16(value){
  if(!Array.isArray(value)||value.length!==3)
    throw new TypeError('three-component Float64 flight position required');
  return value.map(positionToRawQ16);
}
