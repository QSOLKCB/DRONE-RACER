# DRONE-RACER — Mod and Reskin Guide

**This is not a product. This is INDEPENDENCE. 👽**

DRONE-002 implements a working **data-only JSON pack format** for drone flight presets, colours and rectangular gate courses. It does not load arbitrary executable scripts, install mods from the internet or claim to provide the future full VANILLAJS Mod SDK.

## Make your first mod

Download `mods/examples/independence-scout.json`, copy it to `my-drone.json`, and edit the copy. Alternatively use **Download example pack** in the game. Open the game's **Import JSON** selector and select the edited file. It validates and compiles the entire pack before changing the active race; a rejected file leaves the last working pack intact. The maximum import size is **32 KiB**. Imported packs are in-memory only: reselect the file after reload.

The pack must contain exactly `kind`, `id`, `version`, `title`, `accent`, `drone` and `course`. The kind is `qsol.drone-racer.pack.v1` and version is `1`. Give each mod a distinct lowercase slug as its ID. Unknown keys or unsupported versions fail closed.

## Reskin the drone

Set `drone.color` and `accent` to six-digit hexadecimal colours such as `"#ff8800"`. The first colours the procedural drone silhouette in **View: Chase** and the second colours the active racing gates and rotor effects. Press **T** to switch FPV/chase.

This version provides **colour reskins**, not external image/texture import, animated meshes, glTF files, shader plugins, or untrusted HTML/CSS. Those will require separately reviewed local asset formats, bounds and rights metadata.

## Tune handling and thrust

The `drone` object accepts only `name`, `color`, `mass`, `halfSize`, `acceleration`, `maxSpeed`, `response`, `angularAcceleration`, `turnSpeed`, `angularResponse` and `brake`. The numeric values are finite, bounded and used to configure existing Float64 VANILLAJS flight. The limits and checks are in `src/mods.js`.

For instance, changing `acceleration` from `36` to `45` increases thrust response. A different pack ID gets its own local best-time record. The default Independence Sprint retains its old storage key for backward compatibility.

No drone flight parameter is a claim about a calibrated consumer drone.

## Build a course

A course has exactly `{id,version:1,gates}`, and each gate has exactly `{id,x,y,z,width,height}`. Geometry is written as **decimal strings**, not JSON numeric literals.

Example:

    {"id":"01","x":"0","y":"3","z":"-28","width":"14","height":"9"}

Use 2–64 gates. The gate planes descend monotonically along -Z and must be at least 4 metres apart. X centres stay within ±200 metres; Y centres 0–200 metres; Z at least -32767. Gate widths/heights are 2–100 metres. The compiled gate edges must be exactly representable in Q16.16, because imported packs always use explicit `rounding:'exact', overflow:'reject'`.

Read [ALIEN MATH precision and checkpoint semantics](ALIEN_MATH_DRONE_002.md). The game currently supports an ordered, mostly straight run of rectangular gates. A looping circuit, arbitrarily rotated ring and physical wall/obstacle collision are future phases.

## What about game modes and other mods?

Right now, a new pack is a new **track + drone setup**, not an executable gameplay script. To create custom missions, physics modules, true AI racers or shader programs, fork the Apache-2.0 source or wait for the reviewed VANILLAJS Mod SDK extension design.

A JavaScript extension running in the game's origin would have the game's privileges. A manifest or a filename is not a security sandbox. This format is deliberately JSON-only.

The existing [OFFLINE-GAMES Mod Guide](https://github.com/QSOLKCB/OFFLINE-GAMES/blob/main/MOD_GUIDE.md) is a reference for more mature **trusted** local code mods.

## Test and redistribute

    node --test tests/*.test.js
    node scripts/site.mjs build _site
    node scripts/site.mjs verify _site

The example JSON files live in the source repository; import them locally rather than relying on a hosted mod repository. Preserve Apache-2.0 and adapted-source attribution for derivative games.

**Game-specific content lives in DRONE-RACER. Reusable engine improvements go upstream into VANILLAJS.**
