# E-CRAFT v1.0 — Sasquatch Security Mission Acceptance

Status: **PASSED** (automated E2E on dev + preview)

## Required sequence

1. Security HQ
2. Underground lair
3. Get Tracker
4. Activate robot
5. Enter vehicle
6. Drive to forest
7. Find / follow trail (always present; never permanently lost)
8. Find Sasquatch
9. Capture
10. Transport in vehicle
11. Return / enter SUPER JAIL
12. Lock in cell (visible)
13. Reward: `$10,000 TRILLION BILLION`
14. Keep exploring

## Verification

```bash
npm run dev -- --host 0.0.0.0 --port 5173
npm run test:acceptance
```

Result must show `V1 ACCEPTANCE PASSED` with all checklist items `done: true`.

## Scope note

v1.0 = complete **first playable plan** (Sasquatch mission game).
Giant living city / full NPC memory / multiplayer = future versions.
