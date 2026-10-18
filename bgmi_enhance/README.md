# BGMI Tactical Maps

React + TypeScript tactical planning app for Erangel, Miramar and Rondo.

## Run locally
```bash
cd bgmi_enhance
npm install
npm run dev
```

## Checks
```bash
npm test
npm run build
```

## Features
- Tactical marker types: custom, attack, defend, loot, vehicle and recall
- Route waypoint planning and undo/clear
- Distance measurement with a user-adjustable calibration factor
- Grid overlay, searchable marker list, multiple plans
- Local browser autosave plus JSON import/export
- Responsive dark tactical UI

## Map imagery
The original map image binaries (`public/maps/erangel.webp`, `miramar.webp`, `rondo.webp`) still need to be uploaded from the supplied ZIP. The GitHub connector available for this commit can create text files but cannot transmit the 3 large binary image assets, so the committed app will not display its map backgrounds until these files are added.

Plans are stored in local browser storage. Measurements are approximate until the map's scale is calibrated. Tactical intelligence values are community heuristics and not guaranteed spawns.

Independent community planning tool; not affiliated with or endorsed by KRAFTON or PUBG Studios.
