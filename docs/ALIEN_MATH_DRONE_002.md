# DRONE-002 — ALIEN MATH course adoption

**Status:** Exact authored, bounded, axis-aligned drone race gates, with explicit Q16.16 checkpoint admission. **Not** a replacement for the existing floating-point VANILLAJS flight dynamics.

## Pinned source provenance

Original flight/math/time/collision remain from VANILLAJS commit `e2176b0e5f04060ef4bec6acd8a11398e4b86746`. New exact-rational, rational-q16, integer-math, and exact-course are copied unchanged from reviewed VANILLAJS main commit `f91c14628e5700ed4eb69c28cd301a712f3ad967` (after PR #73). All are Apache-2.0, with original SPDX notices. The separate pins are intentional; changing exact authoring does not silently alter the original flight kernel.

## Authoring and compiled geometry

Courses are data-only records with exactly `{id,version:1,gates:[{id,x,y,z,width,height},...]}`. Gate coordinates are canonical bounded decimal **strings**, not Float64. ALIEN MATH calculates rectangle edges as exact rationals and requires the explicit policies `{rounding:'exact',overflow:'reject'}`. Nonrepresentable edges are rejected rather than silently rounded.

A course has 2–64 strictly decreasing -Z gate planes, each at least 4 m after the previous. Supported gates are rectangular in XY planes, not arbitrarily rotated hoops. Compiled courses carry in-memory admission identity and checked signed-int32 raw Q16.16 geometry. JSON exports are data, not executable capability tokens.

## Exact represented Float64 to checked Q16.16 boundary

At every simulation tick, existing Float64 flight supplies prior and current body positions. The game uses DataView to extract the actual IEEE-754 sign, exponent and mantissa of each coordinate, then uses BigInt shifts to multiply the represented binary64 value by 65,536 and truncate toward zero. Values outside signed-int32 Q16.16 are rejected.

The compiled exact-course module classifies each swept path using widened BigInt arithmetic, including multiple consecutive gates in one tick and ordered stopping at the first miss. The race clock remains simulation-tick based. Pixels and camera mode never decide checkpoints.

The conversion is deliberately lossy: a Float64 coordinate less than one Q16 raw unit outside an edge may truncate onto that edge. This is explicitly tested. Float64 flight remains floating point; this does not establish cross-browser replay bit-exactness, physically calibrated aerodynamics or proved ECMAScript source refinement. Leaving representable Q16 range marks a race out-of-bounds and invalidates its finish.

The earlier `gateCrossing` helper remains for DRONE-001 compatibility. Gameplay `advanceRace` is now governed by ALIEN MATH Q16 swept admission.

## Independent evidence and reproduction

`scripts/drone_002_oracle.py` is separately authored Python standard-library code using `fractions.Fraction.from_float` and deterministic boundary/random cases. It never imports JS. Source blobs are pinned to reviewed VANILLAJS revisions.

    node --test tests/drone-002.test.js
    uv run --no-project python scripts/drone_002_oracle.py
    node --test tests/*.test.js
    node scripts/site.mjs build _site
    node scripts/site.mjs verify _site

Finite conformance and rendering assertions do not establish universal correctness. No new physical GPU claims are made.

## Next boundaries

DRONE-003 may add longer looping/circular courses, arbitrary rotated hoops, obstacles, texture/mesh assets, a visual editor, richer data-only packs, trusted local mod APIs and sound/tunnel modes. Each requires separate review and verification.
