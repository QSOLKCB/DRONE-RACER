# DRONE-001 architecture

The first demo keeps physics, race rules and Canvas presentation separated.

| Path | Responsibility |
| --- | --- |
| `engine/{math,time,collision,flight}` | Vendored, source-pinned, unmodified Apache-2.0 VANILLAJS modules |
| `src/track.js` | Validated finite ordered gates and swept plane crossing |
| `src/game.js` | Source-owned race session, 6DOF physics and 60 Hz ticks |
| `src/render.js` | Pure presentation in offline Canvas |
| `src/main.js` | Browser controls, pause/reset, animation and local best time |
| `scripts/site.mjs` | Allowlisted static build and SHA-256 inventory |

Conventions: +Y up, -Z forward, right-handed, xyzw quaternions. The current course's gates lie on fixed z planes and are crossed in order. Obstacles and arbitrary orientation of gate planes are not implemented.

Floating-point VANILLAJS `flight` dynamics are not proof of bit-exact cross-browser physics. Race timing is an integer count of simulation ticks. The local record is not a tamper-proof leaderboard. Exact ALIEN MATH authoring is future independently verified work.

The pinned engine SHA is in [VANILLAJS source identity](../engine/VANILLAJS_SOURCE.md). Any engine update must be separately reviewed with affected regressions. All runtime source and images are local; no CDN imports.


## DRONE-002 additions

- `engine/exact-{rational,course}`, `engine/rational-q16` and `engine/integer-math` copy reviewed VANILLAJS ALIEN MATH from the separate pinned upstream commit recorded in `engine/VANILLAJS_SOURCE.md`.
- `src/track.js` now compiles exact decimal strings and uses the admitted ALIEN MATH raw Q16.16 gate classifier for race advancement.
- `src/position-q16.js` implements the explicit exact-binary64-to-Q16.16 truncation boundary before calling the integer gate classifier.
- `src/mods.js` validates data-only, finite drone/course packs. Imported packs are bounded to 32 KiB; they do not execute user JavaScript.
- `src/render.js` adds an optional chase camera and procedural drone colour without changing simulation or results.
- `src/main.js` handles local import, selection and save-key isolation.

The 001 flight module is **not** replaced by the ALIEN MATH exact course module. For numerical semantics and independent Python evidence, read [ALIEN_MATH_DRONE_002.md](ALIEN_MATH_DRONE_002.md). For what users can edit, read [MOD_GUIDE.md](MOD_GUIDE.md).

## DRONE-003 additions

The game now uses `scene.js` over pinned VANILLAJS `render-optional`; the
original `render.js` remains a compatibility/reference renderer. `circuit.js`
is a separate cardinal v2 checkpoint representation; `track.js` retains the
original v1 bridge and adds lap timing/dispatch. `skins.js` validates cosmetic
JSON without changing flight configuration. `audio.js` separates tick events,
integer PCM reference cues and cancellable Web Audio presentation.

Read [the circuit/presentation contract](CIRCUITS_AND_PRESENTATION.md) for the
exact lap-boundary policy, conservative obstacle-contact limitation, source
pins, event-log profile and independently tested numerical/pixel boundaries.
