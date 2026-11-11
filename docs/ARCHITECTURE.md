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
