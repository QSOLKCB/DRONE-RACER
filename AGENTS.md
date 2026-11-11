# DRONE-RACER engineering rules

- Preserve Apache-2.0 SPDX, VANILLAJS attribution and pinned source revision.
- Runtime must use native modules and local files; no mandatory NPM, Docker, cloud backend or remote assets.
- Keep simulation separate from DOM/rendering, with bounded fixed ticks and input cancellation on pause/blur.
- Validate all source-owned course shapes before consuming them. No unseeded gameplay randomness.
- Do not claim cross-browser bit-exact flight, universal GPU speedups or exact Q16.16 simulation unless independently verified.
- Always run Node regression, allowlisted build, and SHA-256 package verification for implementation PRs.
- No merge, tag, release, GitHub Pages manual branch bypass, or self-hosted GPU without explicit owner approval.
- Preserve the motto: **This is not a product. This is INDEPENDENCE.**

- DRONE-002 preserves source-pinned Float64 flight; exact compiled Q16.16 gates and deliberate Float64-to-raw admission are independent authoring/checkpoint contracts.
- Mod packs are data-only strict JSON with bounded input size; no eval, remote code loading, arbitrary asset URLs or trusted-code sandbox claim.
- Do not weaken source-pinned provenance tests or replace earlier best-time keys. Keep a strict new-invariant check when adding mod/game features.
