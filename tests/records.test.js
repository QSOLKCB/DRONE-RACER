// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULT_PACK,compilePack} from '../src/mods.js';
import {LEGACY_SPRINT_KEY,presetRecordKey,importedRecordKey} from '../src/records.js';

const clone=x=>structuredClone(x);
test('only the actual first-party default selection uses historical sprint key',()=>{
  assert.equal(presetRecordKey('default'),LEGACY_SPRINT_KEY);
  assert.notEqual(presetRecordKey('spectrum'),LEGACY_SPRINT_KEY);
  assert.throws(()=>presetRecordKey('independence-sprint'),TypeError);
});
test('imported packs with same ID never share legacy record, and course changes get new keys',async()=>{
  const original=clone(DEFAULT_PACK);
  const short=clone(DEFAULT_PACK);
  short.course.gates=short.course.gates.slice(0,2);
  short.course.gates[0].z='-4';short.course.gates[1].z='-8';
  // Both courses are admitted even when user keeps the original public ID.
  assert.equal(compilePack(short).id,'independence-sprint');
  const originalKey=await importedRecordKey(compilePack(original).id,original);
  const shortKey=await importedRecordKey(compilePack(short).id,short);
  assert.notEqual(originalKey,LEGACY_SPRINT_KEY);
  assert.notEqual(shortKey,LEGACY_SPRINT_KEY);
  assert.notEqual(originalKey,shortKey);
  assert.equal(await importedRecordKey('independence-sprint',clone(short)),shortKey,
    'the same parsed JSON must get the same content-derived identity');
  const expected=createHash('sha256').update(JSON.stringify(short)).digest('hex');
  assert.equal(shortKey,'qsol.drone-racer.import.independence-sprint.sha256-'+
    expected+'.v1.bestTicks');
});
test('drone reskin or stats edit changes imported records under same ID',async()=>{
  const a=clone(DEFAULT_PACK),b=clone(DEFAULT_PACK);
  b.drone.color='#00ff88';
  assert.notEqual(await importedRecordKey(a.id,a),await importedRecordKey(b.id,b));
  b.drone.color=a.drone.color;b.drone.maxSpeed+=1;
  assert.notEqual(await importedRecordKey(a.id,a),await importedRecordKey(b.id,b));
});
test('import record identity fails closed without supported input',async()=>{
  await assert.rejects(importedRecordKey('bad.id',clone(DEFAULT_PACK)),TypeError);
  await assert.rejects(importedRecordKey('valid',null),TypeError);
});
