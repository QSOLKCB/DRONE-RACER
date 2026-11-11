# How to build a drone game with VANILLAJS

**This is not a product. This is INDEPENDENCE.**

Build from an inspectable game, not a large toolchain. DRONE-RACER uses native ES modules, a local HTTP server, an optional Canvas renderer, and source-pinned VANILLAJS modules. No runtime cloud, account or mandatory package manager is required.

## Source architecture

- `engine/` contains Apache-2.0 VANILLAJS modules copied from exact upstream commits. The original Float64 flight lane remains pinned independently from the new ALIEN MATH authoring lane.
- `src/track.js` compiles source decimal-string gates with ALIEN MATH and classifies ordered swept checkpoints.
- `src/position-q16.js` explicitly truncates the exact represented Float64 flight position to checked signed Q16.16, rather than assuming a JS Number is already fixed point.
- `src/game.js` runs source-owned 6DOF simulation and a 60Hz race clock. `src/render.js` draws FPV and chase views without modifying race state.
- `src/main.js` handles keyboard/touch, pause, input cancellation and local state. `src/mods.js` validates bounded data-only JSON packs.

## Start with a complete player loop

Build a two-gate course, a start/restart button, movement input, a finish condition and a local recorded time. Keep logic independent of DOM, audio and GPU state so bugs can be reproduced with source revision and input sequence. Only after that should you add skins, more gates, rivals, sound or obstacles.

Preserve pause/blur, fixed-step bounds and input cancellation. A held key from a menu or background tab must not become unrequested flight input on resume.

## Use ALIEN MATH deliberately

Compile exact decimal input using the reviewed engine bridge. Require explicit rounding and overflow policy. The accepted Q16.16 aperture edges, not screen pixels, define each gate. If your simulation uses Float64, document and test the exact conversion boundary before calling the fixed-point classifier. Separately verified gate math does not make floating physics bit-exact across browsers.

For custom skins, drone stats and tracks, read [the Mod Guide](MOD_GUIDE.md).

## Improve visuals without changing physics

The chase camera places the viewer behind the same simulated body, then projects a bounded procedural quadrotor. Changing camera view must not change tick count or gate decisions. New textures, imported assets, dynamic lights, optional WebGPU/WASM, longer circular tracks and trippy music belong in distinct reviewed milestones with source pins, failure-path tests and workload evidence.

## Run, verify and distribute

    uv run --no-project python -m http.server 8080 --bind 127.0.0.1
    node --test tests/*.test.js
    node scripts/site.mjs build _site
    node scripts/site.mjs verify _site

Use the game's existing CI and GitHub Pages branch gate. Add tests to protect both your gameplay and packaging semantics. Do not invent speedups or GPU certifications.

References: [VANILLAJS](https://github.com/QSOLKCB/VANILLAJS), [ALIEN Course Foundry](https://qsolkcb.github.io/VANILLAJS/demos/alien-course-lab/index.html), [OFFLINE-GAMES](https://github.com/QSOLKCB/OFFLINE-GAMES), [INDEPENDENCE](https://github.com/QSOLKCB/INDEPENDENCE).

## DRONE-003 circuit example

The new `src/circuit.js` does **not** reinterpret the old decreasing −Z bridge.
It admits a versioned X/Z cardinal course with BigInt swept intersections,
strict within-sweep chronology and continuing lap transitions. See
[the exact circuit contract](CIRCUITS_AND_PRESENTATION.md) before extending it.
Use [the JSON skin/course guide](MOD_GUIDE.md) for game-owned cosmetic parts
and obstacles. The renderer/audio donors remain unchanged, source-pinned
VANILLAJS modules; simulation, collision and logs never read rendered pixels.
