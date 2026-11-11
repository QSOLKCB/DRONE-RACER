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
