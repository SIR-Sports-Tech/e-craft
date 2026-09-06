# Changelog

## 1.12.1 — 2026-09-05 — NO MISSION COMPLETE SIGN

### Fixed
- Removed full-screen **MISSION COMPLETE!** overlay that blocked the screen
- Reward unlocks quietly — keep playing without the banner

## 1.12.0 — 2026-09-05 — FINGER STICK (PHONE + IPAD)

### Added
- **Virtual finger stick** (bottom-right) — drag with your thumb to walk/drive
- Larger stick on **iPad / tablet** breakpoints
- Analog movement with dead-zone; releases cleanly when finger lifts
- Fixed doubled DOM movement input

### Changed
- Coach tips say **DRAG the stick** instead of D-pad taps

## 1.11.0 — 2026-09-05 — HI-RES BUILDING DESIGN

### Added
- **512×448 high-resolution** original building facades (crisp when scaled)
- Distinct designs: Security HQ (glass) · Jail (brick/battlements) · House (cozy) · Plaza (limestone/columns) · Cabin (timber)
- Matching hi-res doors (72×96) seated in facade doorways
- Soft shadows, lit windows, roof tiles, trim, planters / flower boxes

## 1.10.1 — 2026-09-05 — DOORS ATTACHED TO BUILDINGS

### Fixed
- Every door is **parented to its building facade** (no more floating at zone bottoms)
- Doorway recess drawn into building art; interactive door sits in the opening
- Door scale matches facade doorway; exit spawns at the real door

## 1.10.0 — 2026-09-05 — ALL BUILDING DOORS OPEN

### Added
- **Every city building door works** — walk up, tap **E**, go inside
- Enterable: HQ · Jail · House · Clinic · Shop · Police Desk · School · Library · Market · Docks · Airfield · Plaza · Park pavilion
- Themed civic interiors (desk / props / tip) + EXIT
- HQ & Jail always enterable for visit/explore (not mission-gated)
- Door open animation on all fronts

## 1.9.0 — 2026-09-05 — CRAFT BUILD EXPANDED (MINECRAFT-LIKE)

### Added
- **PLACE** button + hotbar PLACE (phone-friendly)
- **Tap/click world** to place in build mode (pointer aim)
- **12 Craft Blocks**: dirt · grass · stone · wood · brick · gold · water · sand · leaf · glass · iron · wool
- **Solid collision** — walk into / bump built walls (water/leaf soft)
- Place/break **particle bursts**
- Chunky cube textures with top/side faces (original art — not Minecraft IP)
- Keyboard: **G** build · **R** place · **Q** break · **1–9 / 0 / - / =** hotbar
- Restart clears craft blocks save

## 1.8.0 — 2026-09-05 — CRAFT BUILD (MINECRAFT-LIKE)

### Added
- Full **Craft Build** mode outdoors + indoors (original cubes — not Minecraft IP)
- Grid snap · stack upward · ghost preview
- Hotbar slots 1–8 (dirt/grass/stone/wood/brick/gold/water/sand)
- **E** place · **BREAK** / Q remove · blocks save to localStorage


## 1.7.2 — 2026-09-05 — RESTART Y/N

### Added
- **RESTART** button
- Confirm: **Are you sure? Y / N**
- Yes clears save + fresh start; No cancels (also keyboard Y/N)


## 1.7.1 — 2026-09-05 — ACTIVATE + DRIVE (CLEAR ON SCREEN)

### Fixed
- **E near bay no longer blocks cars** waiting for robot — free entry like GET IN CAR
- **ACTIVATE ROBOT / GET IN CAR / RACE** moved to the **top** of the left button stack (were buried under many buttons)

### Added
- Big yellow **HOW TO PLAY** coach banner with numbered steps
- Live status strip + interact prompt back on screen
- Clearer phase hints: Activate → Get in car → Hold D-pad ▶


## 1.7.0 — 2026-09-05 — HOUSE LIFE (BED · TV · COOK · BUILD)

### Added
- Walk around inside your house with full walk anims
- **Lay down** in bed (LAY BED / E) — separate from overnight SLEEP
- **TV on/off** with color-bar screen
- **Cook & eat** at the kitchen
- **Craft Blocks** build mode — original colored cubes (not Minecraft IP)


## 1.6.0 — 2026-09-05 — PRO SIGNS + SIREN HEAD

### Added
- **Professional building plaques** (navy/gold civic signs + subtitles)
- When you get close, Sasquatch morphs into a towering **Siren Head** horror form
- Screen shake + warning toast; reverts to Bigfoot when you back away


## 1.5.6 — 2026-09-05 — GET IN CARS + VISIT JAIL

### Fixed / Added
- **GET IN CAR works without robot** (robot no longer required)
- Stand near a city police cruiser + E / GET IN CAR → hop into that **POLICE CAR**
- **VISIT JAIL** button — see Sasquatch in his cell (mouth moves) after he’s locked up


## 1.5.5 — 2026-09-05 — POLICE RUN YOU OVER

### Added
- Get too close to a patrol police car → they **run you over**
- You get **flattened** with a **blood pool** under you
- Can't move until you get up (auto ~3s or tap **UNFREEZE**)
- Short invulnerability after standing so you aren't instantly re-squashed


## 1.5.4 — 2026-09-05 — FACE THE WAY YOU WALK (4-WAY)

### Fixed
- Player now faces **exactly** the walk direction:
  - Right → side face right
  - Left → side face left
  - Down → front face toward you
  - Up → back of head (walking away)


## 1.5.3 — 2026-09-05 — SIDE-VIEW WALK + FACE TURN

### Fixed / Added
- Player is now a true **side-view** walk cycle (profile face + nose + stride)
- Turning left/right **points his face** that direction (flipX)
- Up/down keeps last facing so he still looks like a side walker


## 1.5.2 — 2026-09-05 — PIG FALLS ON YOUR HEAD

### Added
- A **pig** can randomly fall from the sky onto your head (outdoors)
- **PIG!** button (or keyboard `P`) to drop one anytime
- Impact squash + stars + OINK toast, then it bounces away


## 1.5.1 — 2026-09-05 — OPENING DOORS + CLASSIC SASQUATCH

### Added
- Building doors **swing open** when entering HQ / House / Jail
- Door frames + open/closed door art
- Sasquatch remade to classic Bigfoot silhouette with **glowing red eyes**
- **Mouth opens and closes** while idle and walking


## 1.5.0 — 2026-09-05 — REAL STREETS + TRAFFIC SIGNALS

### Added / Improved
- Darker worn asphalt + concrete sidewalks with curb lips
- Double-yellow center lines + solid white edges
- Better zebra crosswalks
- Tall street lamps with warm glow pools (both sides of roads)
- **Traffic signals** at intersections — red / yellow / green cycle
- Clearer street-name signs


## 1.4.4 — 2026-09-05 — FULL SCREEN (NOT TINY)

### Fixed
- Phone was letterboxing a tiny 16:9 strip (~26% of screen)
- Switch to **RESIZE** full-bleed canvas — game fills the whole phone/desktop
- Portrait camera zoom bumped so characters read clearly


## 1.4.3 — 2026-09-05 — ACTIVATE ROBOT (CLEAR)

### Fixed
- New **ROBOT** / **ACTIVATE ROBOT** buttons
- One tap activates tracker + robot and puts you **outside with robot following**
- No more “activated but stuck in lair so it looks broken”


## 1.4.2 — 2026-09-05 — ROBOT PARTNER WORKS

### Fixed
- Robot no longer stranded at lair coords after EXIT
- Snaps beside you on exit house/lair/jail; warps if left behind
- Faster follow on foot + rides with you in the car
- Walk/idle animation so you can see it moving
- **One ACTIVATE** turns on Tracker + Robot together


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
