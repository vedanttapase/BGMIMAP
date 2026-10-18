# BGMI Tactical Maps

A React + TypeScript tactical planning interface for Erangel, Miramar, and Rondo.

## Features
- Click-to-place tactical markers (custom, attack, defend, loot, vehicle, recall)
- Squad route drafting with waypoint undo/clear
- Approximate distance measurement with a user-adjustable calibration factor
- Optional grid overlay, searchable marker list, and map switching
- Local browser autosave, JSON import/export, and multiple named plans
- Responsive dark tactical interface

## Run locally
```bash
npm ci
npm run dev
```

## Verify
```bash
npm test
npm run build
```

## Notes
Plans are stored in the current browser's local storage; use JSON export to move a plan to another device. Coordinate and distance tools operate on the displayed map image. Distance is approximate until calibrated. Vehicle and hot-drop reference notes are community heuristics and can change with game versions or modes.

This is an independent community planning tool and is not affiliated with or endorsed by KRAFTON or PUBG Studios.
