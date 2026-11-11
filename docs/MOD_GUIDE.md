# DRONE-RACER — course and skin mod guide

**This is not a product. This is INDEPENDENCE. 👽**

DRONE-003 has two local JSON formats: course/drone packs and cosmetic skin
packs. Import validates the entire file before activation; rejection leaves
the last working selection intact. No executable code, remote asset URL,
texture download or arbitrary HTML/CSS is accepted. Files stay in memory;
re-import after reload. Export downloads the **currently selected** pack,
including a custom import, so other players can edit and redistribute it.

## Cosmetic skin packs

Choose a skin in the Hangar and switch to **View: Chase** (`T`). Six built-in
skins combine Scout, Manta, Razor and Hauler body shapes with distinct palettes.
**Export skin pack** downloads the starter. A checked-in copy lives at
[`mods/skins/independence-hangar.json`](../mods/skins/independence-hangar.json).
Import edited files with **Import skin JSON**; the limit is **64 KiB**.

A minimal working pack:

```json
{
  "kind": "qsol.drone-racer.skins.v1",
  "id": "my-hangar",
  "version": 1,
  "title": "My Hangar",
  "author": "Your name",
  "skins": [{
    "id": "copper-scout",
    "name": "Copper Scout",
    "colors": {
      "body": "#cc7733", "trim": "#55ffcc",
      "rotor": "#77ddff", "canopy": "#cceeff"
    },
    "parts": [
      {"position": [0, 0, 0], "size": [0.5, 0.25, 0.9], "color": "body"},
      {"position": [0, 0, 0], "size": [1.8, 0.08, 0.12], "color": "trim"}
    ],
    "rotors": [
      {"position": [-0.8, 0.08, 0], "radius": 0.3, "blades": 3},
      {"position": [0.8, 0.08, 0], "radius": 0.3, "blades": 3}
    ]
  }]
}
```

All fields shown are required; extra fields and accessor/sparse-array records
are rejected. IDs are lowercase slugs, at most 48 characters. Titles/authors
are 1–64 characters; skin names 1–48. A pack contains **1–16 unique skins**.
Each skin contains **1–48 cuboid parts** and **0–8 rotors**.

Positions and dimensions are local metres, +Y up and −Z forward. Each part
selects one of the four required six-digit hex colour slots. Part centres are
within ±2 m, dimensions 0.03–3 m, and the complete part must fit inside the
4 m cosmetic cube. Rotor centres are within ±1.5 m, radii 0.1–0.6 m, with
2–5 blades; their full horizontal radius must fit inside ±2 m. These are
**visual bounds**, not hitboxes: large cosmetic parts can overhang the much
smaller physical collision cube. Geometry follows all three drone rotations.

Skins never alter mass, speed, half-size, checkpoints or record keys. Put
handling changes in a course/drone pack. The built-in Scout still respects
DRONE-002's `drone.color`; other selected skins supply their own body palette.
**Built-in skins** restores the original hangar after an import.

## Course and drone packs

Use **Export course** for a complete starter or edit
[`mods/examples/neon-harbour.json`](../mods/examples/neon-harbour.json).
The original `independence-scout.json` and `spectrum-dash.json` examples still
work. The maximum course file size is **32 KiB**.

The outer object contains exactly `kind`, `id`, `version`, `title`, `accent`,
`drone`, `course`. Kind is `qsol.drone-racer.pack.v1`, outer version is `1`;
the inner course independently selects version 1 or 2. Accent is `#rrggbb`.

`drone` has exactly `name`, `color`, `mass`, `halfSize`, `acceleration`,
`maxSpeed`, `response`, `angularAcceleration`, `turnSpeed`, `angularResponse`,
`brake`. Bounded numeric values configure the retained Float64 flight kernel;
see `src/mods.js` for each permitted range. For example, increasing acceleration
from 36 to 45 changes thrust response. These are game presets, not calibrated
real-world drone models.

Imported configurations receive an isolated SHA-256 content-derived record
key. Reusing `independence-sprint` never replaces the original sprint's best
time. Course/drone pack changes get separate records; standalone cosmetic
skin changes do not. Web Crypto is required for imported record identity;
use HTTPS or loopback localhost. Original built-in record keys are retained.

### Version 1: original straight sprint

The course is exactly `{id,version:1,gates}`; each gate has exactly
`{id,x,y,z,width,height}`, with geometry as **decimal strings**:

```json
{"id":"01","x":"0","y":"3","z":"-28","width":"14","height":"9"}
```

Use 2–64 gates descending monotonically along −Z, at least 4 m apart.
X centres stay within ±200 m, Y 0–200 m, Z at least −32767 m. Widths/heights
are 2–100 m. Edges must be exactly Q16.16-representable. These courses are
one-lap sprints with their original non-solid checkpoint behaviour.

### Version 2: directional circuits and obstacles

The course has exactly `id`, `version:2`, `laps`, `spawn`, `gates`, `obstacles`.
Use **1–9 laps**, **4–64 gates**, **0–96 obstacles**. `spawn` is a three-element
array of exact decimal strings. Its largest supported drone cube must clear
all solids. Course geometry is bounded to ±4096 m.

Each gate adds `axis` (`"x"` or `"z"`) and `direction` (`-1` or `1`):

```json
{"id":"east-01","x":"80","y":"8","z":"-160",
 "width":"20","height":"14","axis":"x","direction":1}
```

This gate lies on the X=80 plane and accepts travel towards increasing X.
Its width spans Z, with height along Y. For a Z-plane gate, width spans X.
Apertures are 4–60 m wide/high, have exactly representable Q16.16 edges and
must remain above ground. Gate IDs are unique lowercase slugs. Cardinal
planes support loops with changing directions; arbitrary angled hoops are
not part of this format.

Obstacles are static boxes, with unique IDs across gates and obstacles:

```json
{"id":"pillar-01","min":["12","0","-60"],
 "max":["16","15","-56"],"color":"#ff9955"}
```

All min coordinates must be strictly below max, and min Y must be nonnegative.
The renderer shows the actual boxes used for collision. Gate beams are also
solid. Leave room for corners, approaches, recovery positions and the drone's
configured half-size. Validation checks structure and bounds; it does not
prove your authored course is flyable or make obstacles mandatory shortcuts.

The strict chronological crossing, lap-boundary and contact suppression
rules are specified in [the circuit contract](CIRCUITS_AND_PRESENTATION.md).
On a collision tick, even a genuine crossing before impact is conservatively
withheld. Back up and re-approach the highlighted gate.

## Verify and share

```sh
node --test tests/*.test.js
node scripts/site.mjs build _site
node scripts/site.mjs verify _site
```

The runtime remains native ES modules and local assets. JSON files do not
load scripts, meshes or textures. This is a bounded game mod kit, not the full
future VANILLAJS Mod SDK or a sandbox for same-origin JavaScript. Preserve
Apache-2.0/source attribution when redistributing derivative code; identify
your own artwork and authorship when sharing data packs.
