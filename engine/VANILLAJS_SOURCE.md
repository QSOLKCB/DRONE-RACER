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

## DRONE-003 rendering and sound source

Additional Apache-2.0 modules copied **without modification** from
`QSOLKCB/VANILLAJS@3c461c0322dbdfcfb758983c74f8943ea8d92153`:

| Upstream path | Local path | Git blob SHA-1 |
| --- | --- | --- |
| `modules/audio2d/index.js` | `engine/audio2d/index.js` | `698d2cf9238999cbd6dfd50010c7ba3e49bc5e3a` |
| `modules/render-optional/index.js` | `engine/render-optional/index.js` | `d89d5a041cd3929475f394773b09a917f50f0940` |
| `modules/render-optional/webgpu.js` | `engine/render-optional/webgpu.js` | `ff256e8a95a9ff11538c55ed2299c90a59192d69` |
| `modules/render-optional/wasm-bytes.js` | `engine/render-optional/wasm-bytes.js` | `a04a09e164585bea8675e20ed458875f9521c0e0` |
| `modules/render-optional/project.wat` | `engine/render-optional/project.wat` | `674422d284ad3989458f89dbc33d09872d29e5e7` |

`tests/presentation.test.js` checks every blob. Original flight, collision,
math, time and decreasing −Z ALIEN MATH modules keep their earlier pins.
The WASM byte module is local and ships with its upstream WAT source;
no runtime compiler or download is required. The upstream WASM renderer
credits QSOLKCB/OFFLINE-GAMES; that attribution remains in the copied source.

The game owns v2 cardinal circuits, cosmetics, geometry and musical choices.
No SONIFICATION/E8_MUSIC/SPECTRAL source is copied or executed. VANILLAJS's
existing integer PCM generator meets the sound requirement without bringing
in those repositories' research pipelines or different licences. The music
is an authored eight-note game palette, not a canonical E8/ETQ sonification.
