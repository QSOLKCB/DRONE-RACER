# Flying the Independence Circuit

Serve the repository or built `_site` over HTTP, then open the game. Select a
course, pick a skin, and press **Start race**. No account or runtime network
connection is needed. Hosted offline *reload* is not a service-worker feature;
keep a local copy and local static server for offline use.

| Course | Gates per lap | Laps | Approximate distance per lap |
| --- | --- | --- | --- |
| Neon Harbour | 17 | 3 | 1.28 km |
| Foundry Run | 25 | 2 | 2.04 km |
| Spectral Endurance | 33 | 3 | 2.88 km |
| Independence Sprint | 6 | 1 | Original sprint |
| Spectrum Dash | 6 | 1 | Original sprint |

Fly through the bright gate in its indicated direction. Follow the ground
arrows and minimap; the top-left guide points towards your next gate. Clear
every gate to complete each lap. Brake before corners. Circuits have solid
gate frames and orange obstacles. A contact tick withholds checkpoint credit,
so re-approach any gate you crossed while colliding.

| Input | Action |
| --- | --- |
| W / S | Forward / reverse thrust |
| A / D | Strafe left / right |
| Q / E | Descend / climb |
| Arrow keys | Pitch / yaw |
| C / V | Roll |
| Space | Brake translation and rotation |
| M | Assisted / inertial flight |
| T | FPV / chase camera |
| P / Escape | Pause-toggle / pause |
| R | Restart selected course |
| B | Recover to last checkpoint, with a five-second penalty |

Assisted flight is easier to control. Inertial flight preserves momentum;
there is no universal speed guarantee or bit-exact physics replay. Recover
also zeros momentum and aims at the next gate. Final results show lap splits,
recoveries and your local course best time. Choosing another course restarts
an active race. Cosmetics can change without resetting the race.

Standard gamepads use left stick for horizontal flight, right stick for aim,
triggers for elevation, bumpers for roll and the bottom face button for brake.
A dead zone ignores resting sticks. Touch devices expose thrust, reverse,
strafe, elevation, pitch, yaw, roll and brake buttons.

Opening **Flight settings**, losing focus or hiding the tab pauses the race.
Resume does not charge paused wall time. Form controls retain normal keyboard
behaviour; click the course canvas or use a race button to return to flight.

CPU rendering is the default. Eco lowers rendering work and caps it at 30 fps;
Balanced and High cap rendering at 60 fps. All keep 60 Hz simulation. WebGPU +
WASM is optional and falls back to CPU if unavailable. Fullscreen expands the
cockpit. Actual frame rate depends on the device.

Choose **Sound: On** to start synthesized motor/race cues and optional music.
Volume and music are configurable; pause cancels queued sound. **Export tick
sound log** downloads the reproducible event stream even when playback was
off. Skin/course export buttons download editable JSON starters; see the
[mod guide](MOD_GUIDE.md). Settings and best times are local to this browser.
