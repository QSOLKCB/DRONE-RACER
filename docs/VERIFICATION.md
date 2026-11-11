# DRONE-001 verification contract

Local commands:

    node --test tests/*.test.js
    node scripts/site.mjs build _site
    node scripts/site.mjs verify _site

Tests cover gate bounds, invalid geometry, high-speed swept crossings, order/terminal semantics, 60 Hz flight progression, source packages and local browser script references. Site verification compares every allowlisted distributed asset against a SHA-256 inventory and refuses extraneous/mutated outputs.

The real browser and any GPU hardware require separately executed witnesses; no GPU, pixel-perfect Canvas, universal speedup, cross-browser bit-exact replay or source-level formal proof is claimed.

`.github/workflows/pages.yml` runs on PRs and main pushes. Only a successful main run can deploy, and workflow_dispatch on a feature branch is barred. Repository Settings → Pages must have **GitHub Actions** selected as the source. Site: https://qsolkcb.github.io/DRONE-RACER/

No self-hosted runner, paid API, forced pushes, release or tags are needed.

## Destructive build destination guard

The build script accepts only a dedicated root-level `_site` or `_site-<suffix>` output directory, and rejects source, `.git`, `docs`, parent paths and nested destinations before deletion. A pre-existing output must be a real directory with a complete matching, SHA-256-verified site manifest; an unknown directory, symlink, missing or corrupt inventory, or extra file is never recursively removed. Unit tests exercise the builder against disposable synthetic repositories and check that metadata/source sentinels survive rejection.


## DRONE-002 source/math and modding gates

The extended test suite validates SHA-1 Git blob provenance for vendored ALIEN MATH source, exact gate admission, multi-gate sweeps, Float64 quantization via independent Python `fractions.Fraction.from_float`, malformed data-only packs, preservation of the baseline flight kernel and chase view noninterference.

The Python oracle is finite conformance evidence, not mathematical source refinement. GPU, Canvas pixel identity across browsers, new hardware acceleration, online mod security and universal physics determinism are not claimed.

Review [ALIEN_MATH_DRONE_002.md](ALIEN_MATH_DRONE_002.md) for the numerical trust boundary, [MOD_GUIDE.md](MOD_GUIDE.md) for supported mod fields, and [HOW_TO_MAKE_A_DRONE_GAME.md](HOW_TO_MAKE_A_DRONE_GAME.md) for the reusable architecture.

## DRONE-002 record identity and keyboard accessibility regressions

Imported records are scoped by pack ID and SHA-256 of validated, parsed JSON. Only the built-in default selection may access the original sprint best-time key; imported packs with the same public ID, short courses, reskins or different performance stats receive separate storage keys. Focused inputs/selects retain native arrow/Space and editing behavior, and global flight shortcuts do not run while those controls have focus. Both distributable example JSON packs must compile and match their built-in source configurations.

## DRONE-003 circuit, audio and rendering acceptance

`node --test tests/*.test.js` includes an independent Python oracle in
`scripts/drone_003_oracle.py`. Required coverage:

- 2,048 v2 cases against `fractions.Fraction`, spanning both X/Z directions,
  wrong direction, missed apertures and one-Q16-unit edge perturbations.
- Chronological multi-gate sweeps, missed-gate stopping, coincident crossings,
  exact start/end plane positions, final-lap terminal behaviour and a finishing
  gate followed by the next lap's first gate within one sweep.
- Real VANILLAJS impacts before/after a checkpoint, conservative no-credit
  contact ticks, recovery penalties and complete lap progress for every preset.
- 400 projected vertices across 40 matrices: CPU and actual WASM output equal
  Python `struct` binary32 results **bit for bit**, including per-multiply and
  per-add rounding. The operation order is ((x*m0 + y*m1) + z*m2) + translation.
- Seven cue PCM16LE SHA-256 hashes against independently implemented integer
  synthesis; complete/chunked byte equality; ordered event logs under different
  tick/frame partitions; log caps and snapshot ownership.
- Strict skin/course schema rejection, starter parity, retained source blob
  identities, rendering noninterference, safe storage and gamepad dead zones.
- Original DRONE-001/002 regressions remain enabled without relaxed assertions.

### Packaged Chromium and software WebGPU

After build and SHA verification, run:

```sh
# Playwright is development tooling outside the game/package.
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
DRONE_BROWSER_REPORT=/tmp/drone-browser-report.json \
node scripts/browser-check.mjs
```

`CHROMIUM_EXECUTABLE` is optional if the browser matching Playwright is already
installed. CI installs pinned **Playwright 1.64.0** into `$RUNNER_TEMP`, installs
its Chromium headless shell, and runs this check on hosted Ubuntu. Local
execution can use a preinstalled browser; the actual version is recorded.
The game has no npm runtime dependency or compiler requirement.

The browser check exercises the built `_site`: visible pixels, start/pause,
keyboard thrust, camera/quality settings, WebGPU rejection/fallback, valid and
invalid skin/course imports, active imported-pack export, audio enablement,
preference reload, responsive layout and held touch thrust in a mobile context.
Uncaught page errors fail the test.

`renderer-parity.mjs` explicitly requests a **software fallback adapter**.
It does not opt into the owner's physical GPU or a self-hosted runner. It
uses the production `Backend`, WASM bytes, shaders, buffers, depth testing
and draw submission, replacing only the desktop swapchain attachment with
a real **offscreen GPU texture** for readback. Headless Chromium cannot
reliably expose a desktop swapchain, so onscreen physical-GPU presentation
remains outside this witness.

Six fixtures cover interior triangles, near-plane clipping, viewport clipping,
near/far occlusion, perspective and completely behind-camera geometry.
Production WASM projected coordinates must equal the independent Python
binary32 oracle exactly. GPU raster output is checked separately against:

1. Canvas output: less than 4% of pixels may differ by over 8/255 in any RGB
   channel, accommodating anti-aliasing along primitive boundaries.
2. An independent scalar barycentric/depth raster oracle: more than 10,000
   safe interior/background pixels per 128×128 fixture, with at most **2/255**
   RGB error. A fixed barycentric/depth exclusion band removes edge ambiguity.

These tolerances are explicit fixture contracts, not whole-scene or
cross-device pixel identity. The GPU path's vertex projection is performed by
WASM, not a GPU-compute projection shader. Shader clip-depth remapping and
raster/depth behaviour are exercised by the texture readback.

An additional 36 frames render the actual circuit and chase drone through the
production WebGPU backend while matching body, race and ordered sound events
against an unrendered reference simulation. Device destruction must trigger
CPU fallback. GPU absence or failed readback **fails** this check; it never
silently substitutes CPU evidence.

CI stores screenshots/report as `drone-browser-evidence` for seven days.
Existing main-only Pages deployment still depends on the verification job.
Local results are in [drone-003-evidence.json](drone-003-evidence.json), bound to
SHA-256 digests of the implementation and test inputs. No physical GPU timing,
Firefox/Safari matrix, universal replay proof or live audio identity is claimed.

### Ground contact and obstacle visibility regressions

The follow-up ground/rendering fix adds a shared compiled floor slab for both
course versions and a game-owned CPU depth rasterizer. The pinned donor files
and their provenance assertions remain unchanged; the original DRONE-003
evidence above describes its original source hashes, not the follow-up fix.

`tests/ground.test.js` exercises every preset in assisted and inertial flight,
different drone sizes, held descent at the former non-solid rim, takeoff,
high-speed swept impact and lateral sliding. It also checks custom course
bounds and unchanged airborne motion against the original flight kernel.

The packaged browser check additionally runs
`scripts/ground-visibility-check.mjs`: actual Canvas pixel reads must keep an
unobstructed obstacle face visible during low and high flybys in all quality
presets and both camera views. Held descent must stop at the floor in every
preset. Rendering must leave the authoritative body and race untouched.
These results appear in the browser report's `groundAndVisibility` field,
alongside the existing UI and software WebGPU witnesses.
