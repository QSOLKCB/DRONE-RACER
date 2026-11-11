# DRONE-003: circuits, presentation and tick sound

The original six-gate sprint remains selectable. The new default is Neon
Harbour: 17 gates, three laps and approximately 1.28 km per lap. Foundry Run
has 25 gates, two laps and 2.04 km per lap; Spectral Endurance has 33 gates,
three laps and 2.88 km per lap. Lengths are centreline approximations, not
measurements of a pilot's flown path. Circuits have solid orange obstacles,
solid gate beams and a ground collision slab. Legacy v1 courses retain
non-solid gates and their historical flight/record semantics.

## Authoritative simulation

`game.js` uses the original source-pinned Float64 VANILLAJS flight/collision
modules at 60 Hz. There is no claim of cross-browser bit-exact flight.
`track.js` admits compiled courses in a private WeakMap. Untrusted JSON cannot
supply compiled gate authority. Runtime geometry is immutable.

The **v1** decreasing −Z bridge and its exact tests remain unchanged in
`engine/exact-course`. A **v2** circuit is a separate game-specific format:
cardinal X/Z planes, explicit direction ±1, ordered gates, 1–9 laps, spawn
and static axis-aligned obstacle boxes. Arbitrarily rotated hoops are not
supported. Coordinates are exact decimal strings, quantized with the pinned
rational/Q16 modules using `rounding:'exact', overflow:'reject'`. Existing
checked Float64-to-Q16 truncation remains the flight admission boundary.

`circuitCrossing` widens admitted coordinates to BigInt. A crossing requires
`0 < t <= 1`, motion in the prescribed direction, and a closed aperture.
Starting exactly on a plane does not count; ending exactly on it does.
This is a centre-point checkpoint test; the separate swept cube collision
uses the configured drone half-size and solid gate beams.

Successive checkpoint fractions must be **strictly increasing within the
same sweep**. A first miss stops progress. An array-ordered gate whose
intersection occurred earlier cannot be credited retroactively. Coincident
checkpoints at the same fraction cannot both count and must be re-approached.

A finishing gate completes the lap at the current integer tick. If another
lap remains, the gate index resets and the **same sweep continues**, retaining
the last intersection fraction. A later next-lap first gate can therefore
count in that tick. Final-lap completion is terminal: the remainder cannot
earn gates or begin an extra lap. Lap splits have tick resolution (1/60 s),
not fractional-intersection timing. Each straight sweep considers at most
one circuit plus one gate; a repeated plane cannot have a later fraction.

### Contact policy and recovery

The retained collision solver returns contact data and an endpoint, not the
complete piecewise sliding trajectory. **Every contact tick suppresses all
checkpoint credit**, including a valid crossing before an impact. Timing
continues, and no unverified endpoint chord is treated as the travelled path.
This is a conservative limitation, not exact continuous collision-path
reconstruction. Back up and re-approach a missed gate if needed.

`B` / Recover returns to the last verified gate's exit (or the initial spawn),
zeros momentum, aims towards the next gate and adds **300 ticks / five
seconds** to the race and current lap. It cannot advance gates. Recovery
penalties are included in best times and exported event sample positions.
Malformed or unplayable custom geometry is not an automatic route solver;
authors should leave clearance for the largest allowed drone.

## Presentation and controls

The original wireframe `render.js` remains as a compatibility/reference
renderer. The game uses `scene.js` with pinned VANILLAJS `OptionalRenderer`:
retained cuboid meshes, shaded faces, ground guidance, skyline, gate colours,
rotating rotor blades, first-person/chase cameras and a minimap. Cosmetic
meshes never replace the physical collision cube.

| Preset | Pixel ratio cap | Draw range | Render rate cap |
| --- | --- | --- | --- |
| Eco | 1.0 | 260 m; no skyline | 30 fps |
| Balanced | 1.25 | 550 m | 60 fps |
| High | 1.75 | 1,000 m | 60 fps |

The simulation stays at 60 Hz in all presets. These are work-budget controls,
not measured FPS guarantees. Identical paused frames are skipped. Mesh data
is retained; gate colours update on progression, and drone geometry updates
only for a rendered chase frame. CPU Canvas uses clipped, depth-sorted
primitives; WebGPU uses a depth buffer. Painter ordering can differ for
complex intersecting geometry, so full-scene pixel identity is not claimed.

CPU is the default and requires no WASM or GPU initialization. Choosing
WebGPU + WASM performs a capability check, instantiates local WASM for
projection and uses the GPU for rasterization/depth. Simulation and
checkpoint arithmetic remain on CPU in both modes. There is no separate
WASM physics or GPU-compute simulation mode. Failed initialization, stale
activation, device loss and render failures return to CPU; GPU consent is
not persisted. No physical-device speedup has been measured here.

Preferences persist locally for camera, quality, volume, music, built-in skin,
minimap and turn sensitivity. Imports remain in memory after validation.
Audio and WebGPU require explicit choices each reload. Native form controls
keep their keyboard input; focus changes clear held flight controls. Blur,
hidden tabs and opening settings pause the race. Resume discards paused wall
time. Standard gamepads and complete touch flight controls are available;
physical controller/mobile-device testing remains separate from Chromium QA.

## Deterministic sound boundary

`audio.js` creates cues and musical notes from **simulation ticks**, never
render frames or an ambient random generator. The exported JSON log contains
an ordered stream of `{type,index,tick,sample}` events, `sample = tick * 800`,
a 60 Hz tick rate, a 48 kHz sample rate and a versioned PCM profile. Gate/lap/
finish event order follows actual sweep order, including within one tick.
Music occurs every 15 ticks; motor cues every six ticks use a bounded speed
bucket. Collision cues are rate-limited to once per 30 ticks.

Logging runs while sound is muted too, so playback settings do not change
the canonical full event stream. Recovery produces an explicit event and a
five-second tick/sample gap. Export includes the selected course/drone pack;
it is an event log, **not a full input/physics replay**. Logs hold at most
50,000 events and export `truncated:true` when capped. Exports own their data.

`soundScore(type,index)` canonically normalizes cue variants and returns a
pure pinned integer `audio2d` score. The same exported event regenerates the
same PCM16LE bytes regardless of buffer chunking. No Web Audio oscillator
or platform synthesizer is used to generate those reference samples.

Browser playback converts PCM to AudioBuffers, applies user volume and
schedules from an audio-clock anchor derived from ticks. Pause/restart cancel
queued sources; resumption re-anchors; recovery/stalls cannot queue seconds
of stale notes. The 32-voice bound and scheduling catch-up are presentation
policies. Device resampling, live timing, mixing and output hardware are
**not** identity-bearing audio. The log and individual reference cues are
reproducible; complete live device recordings need not be byte-identical.

## Independent verification

See [verification](VERIFICATION.md) and [local execution evidence](drone-003-evidence.json).
The Python Fraction/binary32/integer-PCM oracle is independently implemented.
The packaged Chromium test compares real WASM output and WebGPU readback,
checks device-loss fallback, and proves game rendering does not change a
matched simulation's body, race or ordered sound log on its finite fixture.

No engine arithmetic pin, physics kernel, release tag or deployment trigger
was replaced. The existing CI deployment still runs only after a main merge.
