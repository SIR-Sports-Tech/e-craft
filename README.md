# E-CRAFT v0.1 — Sasquatch Security Mission

Original free-to-play, family-friendly living-world game prototype.

**Stack:** Phaser 3 + TypeScript + Vite (browser)

## Play

```bash
cd /Users/area_scouts/Documents/e-craft
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

## v0.1 mission (must complete end-to-end)

1. Start at **Security Headquarters**
2. Enter the **secret underground gadget lair** (`E`)
3. Get the **Sasquatch Tracker** (`E`)
4. Activate your **friendly robot** (`E`)
5. Exit lair → enter **security vehicle** (`E`)
6. Drive to the **forest** (WASD / stick)
7. Follow the **trail** (footprints, branches, fur, mud, scratches)
8. **Capture** Sasquatch (`Space`)
9. Load into vehicle (`E`) and drive to **SUPER JAIL**
10. Enter jail (`E`) → lock Sasquatch in the **cell** (`E`)
11. Receive reward: **`$10,000 TRILLION BILLION`**
12. Keep exploring

### Trail rule (non-negotiable)

Sasquatch **always** leaves a trail. If you drift away, a tracking marker / robot reveal points to the nearest clue. You cannot permanently lose the trail.

## Controls

| Input | Action |
|-------|--------|
| WASD / Arrows | Move / drive |
| E | Interact |
| Space | Capture |
| M | Map |
| Esc | Pause |
| On-screen stick + buttons | Touch / tablet |

## Living-world seed (v0.1.3)

Talk to **Builder Jun** in the City Plaza (`E`). The game queues a **Robot Garage** behind Security HQ and builds it over time — early version of “the world remembers what you ask for.”

## Kid safety

Single-player only in v0.1. No stranger chat. No collection of children's personal information. Multiplayer is explicitly later.

## Project layout

```
src/
  main.ts
  game/
    scenes/     Boot, Game, UI
    systems/    TrailSystem
    world/      WorldLayout
    data/       MissionState
```

## Scripts

- `npm run dev` — local play
- `npm run build` — production build
- `npm run preview` — preview build

## License / originality

E-CRAFT is an **original** project. Do not copy Minecraft, The Sims, or other protected assets, code, characters, UI, maps, music, or textures.
