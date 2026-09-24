# Dashboard — VERIFY (Phase 3)

## Tip

- **SHA (full):** `76a672e23f89d3f18ffacc18784316825c02bc6b`
- **Branch:** `review/dashboard-phase3`
- **Branch URL:** https://github.com/01ls1z28-coder/velocitybench-fleet-board/tree/review/dashboard-phase3
- **Repo:** https://github.com/01ls1z28-coder/velocitybench-fleet-board
- **Pages (after review CLEAR / deploy):** https://01ls1z28-coder.github.io/velocitybench-fleet-board/
- **Do not treat main as live** until review CLEAR. Phase 3 is review-branch only.

## Must-ship checklist

| # | Item | Status |
|---|------|--------|
| 1 | **Header buttons** replace ☰ — `#menuBtn` / `#menu` removed; context-aware actions in `.header-actions` (Open another file, Choose export copy; Fleet: Match columns + Use generic layout; Generic: Columns + Use Fleet layout when fleet headers; Export view CSV). Refresh / Auto-check stay in file bar. Narrow: wrap/scroll, never hide behind ☰. | Yes (`index.html`, `css/styles.css`, `js/app.js`) |
| 2 | **Remember last workbook + view** — restore FSA handle when permitted; else gentle `#restoreHint` prompt. Per-workbook fingerprint (`name\|size\|lastModified`): layout mode, sheet, column visibility, sort, filters (localStorage / IndexedDB only). | Yes (`js/app.js`, `js/generic.js`, `js/fleet.js`) |
| 3 | **Click-to-filter** — Generic: KPI cards + category chips toggle filters (click again clears; multi-select chips). Fleet: KPI cards filter queue + table (overdue / 7d / 30d / all); click again clears. | Yes |
| 4 | **Date horizons** on any detected date column (generic): Overdue / Next 7d / Next 30d / All. | Yes (`#dateHorizons` in `js/generic.js`) |
| 5 | **Export current view** — CSV of visible/filtered rows × visible columns only; client-side download. | Yes (`exportViewBtn` → `exportCurrentView`) |

## Kept from prior phases

| Item | Status |
|------|--------|
| FSA + Refresh + lastModified Auto-check | Yes |
| Excel lock banner + Choose export copy | Yes |
| Privacy: IndexedDB / localStorage only, never upload | Yes |
| Generic default; Fleet optional preset | Yes |
| Credits: **Created by Jorge Guerra** only | Yes |
| Hub untouched this tip | Yes (this repo only) |
| Static Pages; `sample-fleet.xlsx` + `sample-orders.xlsx` kept | Yes |

## Screenshots (on box)

- `/workspace/dashboard-phase3-header.png` — Fleet layout; header buttons (Open another / Choose export / Match columns / Use generic / Export view CSV); overdue KPI active filtering queue + table
- `/workspace/dashboard-phase3-generic.png` — Generic on `sample-orders.xlsx`; date horizons (Order Date / Due Date); category chip filter; Export view CSV + Columns in header

**Note:** Playwright loads via `<input type=file>` (FSA needs a real user gesture). Screenshots show fallback-mode banner; FSA path is exercised manually in Chrome/Edge.

## Smoke

```bash
cd /workspace/velocitybench-fleet-board
python3 -m http.server 8899 --bind 127.0.0.1
# open http://127.0.0.1:8899/ — Chrome preferred for FSA
# sample-orders.xlsx → generic horizons / chips / Export view CSV
# sample-fleet.xlsx → accept Fleet → header Match columns / KPI click-to-filter
```

## Credit / privacy / rg

- Footer and README credit **Created by Jorge Guerra** only.
- No Sati / Seraph / Merovingian / builder display names in shipped UI or docs.
- No `#menuBtn` / `#menu` hamburger left.
- Privacy disclaimer: data stays in this browser / never uploaded.
