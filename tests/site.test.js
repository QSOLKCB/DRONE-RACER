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
