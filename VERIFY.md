# Fleet Board — VERIFY (Phase 2)

## Tip

- **SHA (full):** `95ff0b823a4499177410b54d649fb75a656a3411`
- **Branch:** `review/fleet-board-phase2`
- **Repo:** https://github.com/01ls1z28-coder/velocitybench-fleet-board
- **Pages (after review CLEAR / deploy):** https://01ls1z28-coder.github.io/velocitybench-fleet-board/
- **Do not treat main as live** until review CLEAR. Phase 2 is review-branch only.

## Feature checklist

| Item | Status |
|------|--------|
| FSA path (`showOpenFilePicker` → handle → Refresh via `getFile()`) | Yes (`js/app.js`) |
| IndexedDB persist of handle (`fleetboard-fsa-v1`) + query/requestPermission | Yes |
| Auto-check toggle default ON; poll ~4s while visible; pause when hidden | Yes |
| Fallback `<input type=file>` + drag-drop; Refresh re-prompts | Yes |
| Excel lock banner + Retry + Choose export copy | Yes |
| **Generic mode DEFAULT:** sheet picker, header row → columns, type infer (`number`/`date`/`text`/`category`) | Yes (`js/generic.js`) |
| Auto KPIs: row count; numeric sum/avg/min/max (≤4); date overdue/≤7d/≤30d; category top chips | Yes |
| Searchable table + sortable headers + column show/hide (`localStorage` by header hash) | Yes |
| **Fleet preset:** detect Unit#/Reg.Exp/90-day → CTA “Use Fleet layout”; v1 KPIs/queue/drawer/mapper kept | Yes (`js/fleet.js`) |
| Default remains Generic until user opts in; choice remembered | Yes |
| Hub brass/dark chrome | Yes |
| Credits: **Created by Jorge Guerra** only | Yes |
| No upload / no backend | Yes |
| Vendored SheetJS + `sample-fleet.xlsx` + `sample-orders.xlsx` | Yes |
| HOW-TO: Chrome/Edge, any workbook, Refresh after Excel Save, fleet preset note | Yes |

## Screenshots (on box)

- `/workspace/fleet-board-phase2-generic.png` — generic mode on `sample-orders.xlsx` (auto KPIs + typed table)
- `/workspace/fleet-board-phase2-fleet.png` — fleet preset on `sample-fleet.xlsx` (queue + KPIs)

**Note:** Playwright automation loads via `<input type=file>` (FSA needs a real user gesture / native picker). Screenshots show fallback-mode banner; FSA path is exercised manually in Chrome/Edge. Smoke: generic Orders → 10 rows, Amount/Due date KPIs, category chips; fleet sample → Units **8**, 90-day overdue **2**, Due in 7 days **1**, Due in 30 days **3**. Footer credit Jorge Guerra.

## Smoke

```bash
cd /workspace/velocitybench-fleet-board
python3 -m http.server 8899 --bind 127.0.0.1
# open http://127.0.0.1:8899/ — Chrome preferred for FSA
# Choose sample-orders.xlsx (generic) or sample-fleet.xlsx (accept Fleet layout CTA)
```

## Credit / privacy checks

- Footer and README credit **Created by Jorge Guerra** only.
- No builder/agent display names in HTML, README, HOW-TO, or shipped comments.
- Privacy disclaimer in footer: data stays in this browser / never uploaded.
