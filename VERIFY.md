# Fleet Board — VERIFY

## Tip

- **SHA (full):** `4c1bf39e1de56571e54095eaf7bfd3b88492dcae`
- **Branch:** `review/fleet-board-v1`
- **Repo:** https://github.com/01ls1z28-coder/velocitybench-fleet-board
- **Pages (after review CLEAR / deploy):** https://01ls1z28-coder.github.io/velocitybench-fleet-board/
- **Do not treat main as live** until review CLEAR.

## Feature checklist

| Item | Status |
|------|--------|
| FSA path (`showOpenFilePicker` → handle → Refresh via `getFile()`) | Yes (`js/app.js`) |
| IndexedDB persist of handle (`fleetboard-fsa-v1`) + query/requestPermission | Yes |
| Auto-check toggle default ON; poll ~4s while `visibilityState===visible`; pause when hidden | Yes |
| Fallback `<input type=file>` + drag-drop; Refresh re-prompts with clear copy | Yes |
| Excel lock banner + Retry + Choose export copy | Yes |
| Column mapper + `localStorage` `fleetboard-map-v3` + FIELDS aliases from Jorge test | Yes (1:1) |
| KPIs / queue ≤45d / drawer / search / filters / tone chips / date parsing | Yes (1:1 rules) |
| Hub brass/dark chrome (`--bg #050607`, accent `#4cc9f0`, lime `#c8ff4a`, carbon, radius 14) | Yes |
| Credits: **Created by Jorge Guerra** only | Yes |
| No upload / no backend | Yes |
| Vendored SheetJS + `sample-fleet.xlsx` | Yes |

## Screenshots (on box)

- `/workspace/fleet-board-after.png` — full board (KPIs + queue + table) with `sample-fleet.xlsx`
- `/workspace/fleet-board-toolbar.png` — live bar: Auto-check + Refresh + Match columns

**Note:** Playwright automation loads via `<input type=file>` (FSA needs a real user gesture / native picker). Screenshot shows fallback mode copy; FSA path is exercised manually in Chrome/Edge. Smoke KPIs from sample: Units **8**, 90-day overdue **2**, Due in 7 days **1**, Due in 30 days **3**; queue items present; footer credit Jorge Guerra.

## Smoke

```bash
cd /workspace/velocitybench-fleet-board
python3 -m http.server 8899 --bind 127.0.0.1
# open http://127.0.0.1:8899/ — Chrome preferred for FSA
# Choose sample-fleet.xlsx (or real workbook)
```

Also works via `file://` for basic load; FSA may require a secure context (http/https localhost).

## Credit / privacy checks

- Footer and README credit **Created by Jorge Guerra** only.
- No builder/agent display names in HTML, README, HOW-TO, or comments that ship.
- Privacy disclaimer in footer: data stays in this browser / never uploaded.
