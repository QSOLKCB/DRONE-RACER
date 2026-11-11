# DRONE-RACER — research and game development roadmap

**Current:** DRONE-001/002 are the retained baseline. DRONE-003 circuits, skins and presentation are implemented in this review branch; owner merge and deployment remain pending.

## Policy

- DRONE-RACER owns tracks, game rules and progression. Reusable improvements flow upstream to [VANILLAJS](https://github.com/QSOLKCB/VANILLAJS).
- Work sequentially: one PR, executed evidence, owner review, merge, then authorization for the next phase.
- No forced merge, moving release tags, unreviewed self-hosted GPU work, network-required runtime or scientific claims without independent evidence.

## DRONE-001 — First Flight (merged)

- [x] 6DOF source-pinned VANILLAJS flight and fixed 60 Hz simulation.
- [x] Six ordered swept-checkpoint race gates and integer tick timing.
- [x] Assisted and inertial modes, keyboard/touch controls, local record, pause and reset.
- [x] Pure Canvas presentation with no mandatory GPU backend.
- [x] Tests, documentation, SHA-256-verified static build and GitHub Pages workflow.
- [x] Original PR CI passed; GitHub Pages deployed after reviewed merge.

## DRONE-002 — ALIEN MATH and data-only mod kit (retained)

- [x] Source-pinned reviewed ALIEN MATH course bridge and unchanged original Float64 flight kernel.
- [x] Checked exact authoring with explicit Q16.16 quantization and widened swept gate admission.
- [x] Independent Python exact-Float64 Fraction oracle; representative edge/rejection cases and source blob pin tests.
- [x] Two working drone/course presets, bounded JSON import, colour reskins and independent local records.
- [x] Optional third-person chase view drawn from existing flight pose.
- [x] How-to, mod and numerical boundary documentation.
- [ ] Visual drag/drop course editor and arbitrary oriented hoops: future phase.
- [ ] Cross-browser bit-exact physics/replay proof: not claimed; remains open.

## VANILLAJS-OPT-002 — workload-based engine optimization

- [ ] Profile actual drone workloads: gate counts, candidate collision queries, drawing, allocations, frame budgets.
- [ ] Optimize bounded culling, spatial queries, mesh retention and batching only where output parity is established.
- [ ] Alternating A/B benchmarks, negative controls, exact source and machine receipts.
- [ ] Contribute verified shared abstractions back upstream in reviewed VANILLAJS PRs.
- [ ] Safe invariant-aware CI witness reuse, with changed/new obligations always executing.

## VANILLAJS-GPU-002 — opt-in WebGPU and WASM expansion

- [x] CPU-first playable renderer and explicit user choice.
- [x] Pinned bounded WebGPU buffers and WASM projection, with independent numeric/pixel checks.
- [ ] Test hardware device loss, fallback and distinct CPU/GPU timings.
- [x] CPU/WebGPU game-rendering noninterference checks for body, race and sound events.

## DRONE-003 — Independence Circuit (this PR)

- [x] Separate exact cardinal v2 courses, ordered lap boundaries and solid obstacles.
- [x] Three long multi-lap courses; preserved v1 sprint source and records.
- [x] Six cosmetic skins and a bounded JSON body/rotor/palette mod pack.
- [x] Tick sound-event logs, independent integer PCM oracle and generated music.
- [x] CPU quality presets, opt-in WASM/WebGPU presentation and fallback.
- [x] Minimap, guidance, lap results, checkpoint recovery, preferences and controls.
- [x] Independent Fraction/binary32/PCM oracles and software WebGPU readback.

### Later modding studio work

- [ ] Versioned local data-only track, drone, asset and race-mode manifests.
- [ ] Modifiable race rules, replay-controlled trials, custom drone handling and safe save migration.
- [ ] Visual track editor, local pack creation and verified provenance.
- [ ] Integrate future native VANILLAJS Mod SDK. Same-origin executable JavaScript mods must be labelled trusted code, not a sandbox.
- [ ] Guides modelled on [OFFLINE-GAMES MOD_GUIDE](https://github.com/QSOLKCB/OFFLINE-GAMES/blob/main/MOD_GUIDE.md) and [HOW_TO_MAKE_OFFLINE_GAMES](https://github.com/QSOLKCB/OFFLINE-GAMES/blob/main/HOW_TO_MAKE_OFFLINE_GAMES.md).

## DRONE-004 — polished game and reproducible release

- [ ] Ghost trials, local championships and AI rivals; further audio/visual polish.
- [ ] Performance and deterministic-replay evidence with explicit limitations.
- [ ] End-to-end offline game/mod documentation and versioned distribution.
- [ ] Owner-approved release, immutable tag and any optional archive record.

## Research boundaries

- [VANILLAJS](https://github.com/QSOLKCB/VANILLAJS): engine modules and future Mod SDK.
- [OFFLINE-GAMES](https://github.com/QSOLKCB/OFFLINE-GAMES): existing game mod lessons and source-owned distribution.
- [INDEPENDENCE](https://github.com/QSOLKCB/INDEPENDENCE): **This is not a product. This is INDEPENDENCE.**
