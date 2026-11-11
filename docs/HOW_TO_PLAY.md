# DRONE-RACER — how to play

Open [GitHub Pages](https://qsolkcb.github.io/DRONE-RACER/) or serve a local clone:

    uv run --no-project python -m http.server 8080 --bind 127.0.0.1

Click **START RACE** and pass each highlighted rectangular gate, in order, moving toward world -Z. The game uses swept checkpoints, so a fast crossing cannot be lost between simulation ticks.

| Key | Action |
| --- | --- |
| W/S | Forward/reverse thrust |
| A/D | Left/right strafe |
| Q/E | Down/up thrust |
| Arrow keys | Pitch/yaw |
| C/V | Roll |
| Space | Brake |
| M | Assisted/inertial toggle |
| P | Pause/resume |
| R | Restart |

Touch buttons give a simpler forward/strafe/yaw/brake layout. The first demo is primarily keyboard-oriented; full mobile controller ergonomics and gamepad support remain planned.

The race currently has no collision walls, gates as solid meshes, ranked server, damage, cloud sync, AI pilots or drone upgrades. Leaving the track is possible. Losing window focus clears input and pauses the game.


## DRONE-002 controls and mods

Use **View: Chase** or press **T** to switch between FPV and a procedural third-person drone. Switch between **Independence Scout** and **Spectral Wasp** from the Mod Kit. Changing packs resets the race safely; each pack has its own best-time record.

Click **Download example pack**, edit the resulting JSON offline, then **Import JSON** to validate and play the new track/drone. Invalid packs do not replace a running, validated pack. See [Mod Guide](MOD_GUIDE.md).

The active race now uses ALIEN MATH Q16.16 compiled gate boundaries. This does not make the Float64 flight simulation itself bit-exact across browsers.
