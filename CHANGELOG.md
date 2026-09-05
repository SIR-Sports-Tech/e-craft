
## 0.1.3 — 2026-09-05

### Added
- Living-world seed: ask **Builder Jun** to build a **Robot Garage** behind HQ; it constructs over time and persists in-session.
- Citizen dialogue (Pike, Jun, Ada, Remy)
# Changelog

## 0.2.3 — 2026-09-05

### Added
- Day/night cycle
- Job Board + Head of Security / Builder Aide
- Inventory + mystery radio tips (R)
- Friendship Park NPCs + lost kite side quest
- Shop / Clinic / Sky Patrol interactions


## 0.2.2 — 2026-09-05 — CHROME BETTER BUILD

### Added
- **Chrome-proof DOM controls**: on-screen D-pad + E/Capture buttons always available
- Window-level keyboard capture (works even if canvas focus is weird)
- Mission status HUD panel over the game
- Footstep dust particles + smoother camera

### Fixed
- Desktop control reliability in Google Chrome

### Test
- http://127.0.0.1:5173/?skiptitle=1
- http://127.0.0.1:4173/?skiptitle=1


## 0.2.1 — 2026-09-05 — CONTROLS + ART FIX

### Fixed
- **Controls:** removed bob-tween fighting WASD; desktop no longer shows touch overlay that stole input; keyboard focus on game; faster move speed
- Title: bigger NEW GAME button + **Enter/Space** to start
- Scale mode FIT for stable layout

### Improved
- Larger clearer original sprites (officer, robot, sasquatch, car, buildings, trees)

### Test
- http://127.0.0.1:5173/?skiptitle=1 (jump into game)
- http://127.0.0.1:5173/ (title screen)
- Preview: http://127.0.0.1:4173/?skiptitle=1


## 0.2.0 — 2026-09-05 — TEST BUILD

### Added
- **Title screen** with New Game / Continue
- **Autosave** (localStorage) every 8s + load on Continue
- **Original SFX** (pickup / capture / success / talk)
- Expanded city: Clinic, Sky Patrol Pad, Gadget Shop
- Stronger lair lighting strips

### For testers
- Dev: http://127.0.0.1:5173/
- Preview build: http://127.0.0.1:4173/


## 0.1.4 — 2026-09-05

### Changed
- Replaced bare colored blocks with **original drawn sprites**: officer, robot, sasquatch, patrol vehicle, buildings with roofs/windows, grass/road tiles, trees, trail icons, citizens


## 0.1.1 — 2026-09-05

### Added
- Yellow **objective arrow** always points to the next mission step
- On-screen **mission checklist** (HQ → jail → reward)
- Captured Sasquatch **follows** the player to the vehicle
- Easier vehicle load radius + mid-drive load
- QA keys: **F9** advance / **F10** force-complete mission
- Playwright browser smoke script

### Fixed
- Sticky capture → transport handoff
- Jail vs lair indoor visibility switching

## 0.1.0 — 2026-09-05



### Added
- Phaser 3 + TypeScript + Vite project scaffold
- Playable Sasquatch Security Mission loop
- Security HQ, underground gadget lair, city roads, Super Jail, forest
- Sasquatch Tracker + friendly robot partner + security vehicle
- Dynamic Sasquatch wander with **always-on trail** (footprints, branches, fur, mud, scratches)
- Trail fallback marker + robot nearest-clue help (never permanently lose trail)
- Capture → transport → jail cell lockup → ridiculous reward
- Keyboard controls (WASD/E/Space/M/Esc) + touch joystick / buttons
- Pause overlay, city map overlay, mission HUD
- README, CHANGELOG, TODO
