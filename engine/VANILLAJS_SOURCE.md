# Pinned VANILLAJS source

Original repository: https://github.com/QSOLKCB/VANILLAJS

Immutable source commit: `e2176b0e5f04060ef4bec6acd8a11398e4b86746`

- `modules/math/index.js` copied without modification to `engine/math/index.js`
- `modules/collision/index.js` copied without modification to `engine/collision/index.js`
- `modules/flight/index.js` copied without modification to `engine/flight/index.js`
- `modules/time/index.js` copied without modification to `engine/time/index.js`

These source files retain Apache-2.0 SPDX attribution. Updating the pin requires a separate reviewed PR with regression evidence. There is no runtime remote import.

## ALIEN MATH source (DRONE-002)

Additional Apache-2.0 modules are copied verbatim from the reviewed VANILLAJS `main` commit `f91c14628e5700ed4eb69c28cd301a712f3ad967` (after PR #73):

- `modules/exact-rational/index.js` → `engine/exact-rational/index.js`
- `modules/rational-q16/index.js` → `engine/rational-q16/index.js`
- `modules/integer-math/index.js` → `engine/integer-math/index.js`
- `modules/exact-course/index.js` → `engine/exact-course/index.js`

The original DRONE-001 math/time/collision/flight modules remain pinned to their earlier source commit. Two independent source revisions are documented deliberately; this is not a claim that the floating flight kernel was upgraded or formally refined.
