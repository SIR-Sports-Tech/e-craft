# Changelog

## 1.4.1 — 2026-09-05 — ALL BUTTONS WORK

### Fixed
- Cars no longer engage while still flagged “inside house” (broken stacked state)
- Trail toasts no longer bury indoor button feedback
- Button taps: pointerdown-only + live API status toast (no silent fails)
- New **EXIT** button leaves house / lair / jail
- Compact 2-column action grid so every control stays on-screen


## 1.4.0 — 2026-09-05 — REAL BUILDING INTERIORS

### Added
- **Your House**: wood floors, wallpaper, couch, TV, table, plant, kitchen, curtains, nightstand lamp, door
- **Gadget Lair**: metal floor, server racks, consoles, glowing tracker pedestal, robot charge bay, ceiling lights
- **Super Jail**: concrete floor, booking desk, security cam, barred cell + bench, door frame


## 1.3.2 — 2026-09-05 — LIFELIKE STREETS

### Added
- Concrete **sidewalks** along every road
- Asphalt grit + white edge lines + yellow dashed center lanes
- **Crosswalks** + stop lines at major corners
- Intersection pads where roads meet
- Street lamps, manholes, street-name signs (MAIN / PARK / MARKET / FOREST)


## 1.3.1 — 2026-09-05 — POLICE CARS ON THE STREETS

### Added
- **3 city police cars** cruise road loops (Main / Park / Market / HQ Drive)
- Black-and-white cruisers with flashing red/blue lights
- Hide while indoors; keep driving forever outdoors


## 1.3.0 — 2026-09-05 — SUNRISE + BLACK PANTHER

### Added
- **Sun rises** in the sky and arcs sunrise → noon → sunset (moon at night)
- Time label shows Sunrise / Day / Sunset / Night
- Sleeping still jumps to morning — you wake to a risen sun
- **Black panther** randomly leaps out outdoors, then races into the trees
- **PANTHER!** button to trigger a jump-scare anytime outside


## 1.2.1 — 2026-09-05 — REAL PLAYER WALK CYCLE

### Fixed / Added
- Officer no longer slides — **6-frame walk cycle** with alternating legs, boots planting, arm swing, body bob
- Idle pose when standing still
- Walk anim resumes after exiting cars / house / jail


## 1.2.0 — 2026-09-05 — YOUR HOUSE + SLEEP

### Added
- **Your House** near Friendship Park (red home)
- Walk in with **E** / **GO HOME** button / keyboard `H`
- Cozy interior with bed, lamp, window
- **SLEEP** (bed E / SLEEP button / `Z`) fades out and skips time to **morning 7:00**
- Exit house with E at the door


## 1.1.1 — 2026-09-05 — NO-OVERLAP TOUCH CONTROLS

### Fixed
- Removed duplicate Phaser virtual stick + on-canvas buttons that sat on top of DOM controls
- LEFT actions + RIGHT D-pad now use separate columns with a hard middle gap
- Smaller buttons + safe-area insets so phone screens never collide
- Layout smoke test across 320 / 375 / 390 widths


## 1.1.0 — 2026-09-05 — HOLD TRACKER + WORKING TRAIL

### Fixed / Added
- **HOLD TRACKER** button (and keyboard `T`) — you physically hold the gadget
- Tracker in-hand sprite + green scan arrow + pulse radar
- Trail stays **dim until you hold the tracker**, then lights a **bright gold path**
- Bigger glowing footprints / fur / mud / branch clues with labels
- Seeded forest entrance → Sasquatch trail so tracking works on arrival
- Tracker distance readout: “Tracker: Footprint — 240m”
- Pedestal disappears when you pick it up; auto-hold on ACTIVATE / E

### Play
1. Tap **ACTIVATE** (or HOLD TRACKER) in lair
2. Exit → car → forest
3. Keep **HOLD TRACKER** on — follow the gold trail + green arrow


## 1.0.9 — 2026-09-05 — NO MORE START-OVER

### Fixed
- **Auto-resume**: reload keeps your save (no more start from scratch after freeze)
- FPS watchdog auto-UNFREEZE + trail emergency trim
- HUD text rebuild throttled (was freezing phones every frame)
- Dust particles disabled on phones
- Autosave every 2s + on tab hide / page close
- Trail cap 40 + cheaper label updates
- Phone FPS capped ~40 for stability

### Play
- Same phone link auto-continues if you already played
- Fresh start: add `&new=1`
- Stuck: tap **UNFREEZE / SAVE**


## 1.0.8 — 2026-09-05 — ANTI-FREEZE

### Fixed
- Trail clue cap (was growing forever → phone freeze)
- Grass/road no longer spawn 2000+ tile images
- Frame try/catch + UNFREEZE / SAVE button
- Autosave every 3s + on capture/car
- Toast no longer spam every frame
- Continue via `?continue=1`


## 1.0.7 — 2026-09-05 — RACE CAR + BOTH CARS DRIVE

### Added
- **RACE CAR** (red) next to patrol bay — tap **RACE CAR** button
- **PATROL CAR** button for security vehicle
- Race car is faster than patrol

### Tested
- BOTH CARS DRIVE PASSED (patrol ~448px / race ~600px in 0.8s hold)


## 1.0.5 — 2026-09-05 — CAPTURE KNOCKDOWN

### Fixed / Added
- CAPTURE button knocks Sasquatch **down** (fall tween, red flash, stun stars, DOWN!)
- Much larger capture range for phone play
- Clear toast if too far / missing tracker


## 1.0.4 — 2026-09-05 — SCARY WALKING SASQUATCH

### Added
- Terrifying Sasquatch redesign: glowing red eyes, fangs, claws, hunched bulk
- Real **walk cycle animation** (4 frames) that plays while moving
- Faces walk direction; larger scale in forest


## 1.0.3 — 2026-09-05 — CAR DRIVE FIX

### Fixed
- Car drag was killing velocity — drag now 0 while driving
- Faster drive speed + instant forward kick when entering car
- D-pad uses pointer capture so hold-to-drive works on phones
- Proven: hold ▶ for 1s moves car ~400–550px


## 1.0.2 — 2026-09-05 — CONTROLS ACTUALLY WORK

### Fixed
- Buttons now call the game directly (ACTIVATE / CAR / E / CAP / D-pad)
- Added explicit **ACTIVATE** button (tracker + robot)
- **GET IN CAR / DRIVE** one-tap enter + proven driving
- Removed covering instruction boxes
- Realistic dirt trail prints
- Playwright phone-viewport test: ACTIVATE → CAR → drive PASSED


## 1.0.1 — 2026-09-05 — UX HOTFIX

### Fixed
- Removed giant instruction / checklist / inventory boxes covering the screen
- Controls: compact E / CAP / CAR + D-pad that actually work on phone/Chrome
- Vehicle entry radius + bay zone; car now drives with pad/WASD
- Sasquatch trail looks like real dirt prints/scuffs (not neon stickers)


## 1.0.0 — 2026-09-05 — FIRST PLAN COMPLETE

### Done
- Full Sasquatch Security Mission acceptance sequence
- Automated E2E (`npm run test:acceptance`) PASSED
- Phone LAN play + Chrome DOM controls
- Trail never permanently lost
- Reward `$10,000 TRILLION BILLION`
- Free explore after mission


## 0.2.4 — 2026-09-05

### Added
- City expansion: Police Desk, Friendship School, Library, Market Row, River Docks
- **Police coordination**: talk to Officer Pike → Forest Sweep Patrol (progresses over time)
- **HQ Security Wing** upgrade order after Head of Security unlock (world remembers)
- Day/night `phase()` used for citizen schedule hooks
- HUD shows job title + police trust lines

### Changed
- World size 4200×2800; forest shifted east

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
