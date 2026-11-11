# DRONE-001 verification contract

Local commands:

    node --test tests/*.test.js
    node scripts/site.mjs build _site
    node scripts/site.mjs verify _site

Tests cover gate bounds, invalid geometry, high-speed swept crossings, order/terminal semantics, 60 Hz flight progression, source packages and local browser script references. Site verification compares every allowlisted distributed asset against a SHA-256 inventory and refuses extraneous/mutated outputs.

The real browser and any GPU hardware require separately executed witnesses; no GPU, pixel-perfect Canvas, universal speedup, cross-browser bit-exact replay or source-level formal proof is claimed.

`.github/workflows/pages.yml` runs on PRs and main pushes. Only a successful main run can deploy, and workflow_dispatch on a feature branch is barred. Repository Settings → Pages must have **GitHub Actions** selected as the source. Site: https://qsolkcb.github.io/DRONE-RACER/

No self-hosted runner, paid API, forced pushes, release or tags are needed.
