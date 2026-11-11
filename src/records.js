// SPDX-License-Identifier: Apache-2.0
// Race record identity belongs to the selected content, not only its public ID.
// This module has no storage side effects; callers select the key explicitly.
export const LEGACY_SPRINT_KEY='qsol.drone-racer.independence-sprint.v1.bestTicks';
export function presetRecordKey(preset){
  if(preset==='default')return LEGACY_SPRINT_KEY;
  if(preset==='spectrum')return 'qsol.drone-racer.preset.spectrum-dash.v1.bestTicks';
  if(['neon','foundry','endurance'].includes(preset))return 'qsol.drone-racer.circuit.'+preset+'.v1.bestTicks';
  throw new TypeError('unknown first-party preset');
}
/**
 * A verified JSON import is never allowed to claim the legacy sprint record.
 * SHA-256 of canonical parsed JSON keeps different courses/drone stats separate
 * even when the author deliberately reuses an existing pack ID.
 * Offline in a secure browser context (HTTPS or loopback localhost).
 */
export async function importedRecordKey(packId,source){
  if(typeof packId!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(packId)||
      source===null||typeof source!=='object')
    throw new TypeError('validated imported pack required');
  const json=JSON.stringify(source);
  if(typeof json!=='string'||json.length>32768)
    throw new RangeError('imported pack exceeds identity budget');
  if(!globalThis.crypto?.subtle)
    throw new Error('Web Crypto SHA-256 is required to identify custom race records');
  const digest=new Uint8Array(await globalThis.crypto.subtle.digest(
    'SHA-256',new TextEncoder().encode(json)));
  const hex=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
  return 'qsol.drone-racer.import.'+packId+'.sha256-'+hex+'.v1.bestTicks';
}
