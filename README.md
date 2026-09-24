# VelocityBench Dashboard

Local Excel → flexible dashboard. Open any workbook on this computer; the browser builds KPIs and a table from your **header row**. **Nothing is uploaded.**

**Created by Jorge Guerra.**

## Live (after Pages deploy)

https://01ls1z28-coder.github.io/velocitybench-fleet-board/

Hub: [velocitybench.com](https://velocitybench.com/) · Bench: [velocitybench.com/bench/](https://velocitybench.com/bench/)

## Features

- **Generic layout (default):** any `.xlsx` / `.xls` / `.csv` → inferred column types, auto KPIs, searchable/sortable table, column show/hide
- **Click-to-filter:** KPI cards and category chips toggle table filters (multi-select where natural; click again clears)
- **Date horizons:** on every detected date column — Overdue / Next 7d / Next 30d / All
- **Export view CSV:** download currently visible/filtered rows and visible columns only (client-side)
- **Remember last workbook + view:** layout mode, sheet, column visibility, sort, and filters restored per workbook fingerprint (local only)
- **Header actions** (no hamburger): Open another file, Choose export copy, Columns / Match columns, Use Fleet / generic layout, Export view CSV
- **Fleet layout preset (optional):** detect Unit# / Reg.Exp / 90-day headers → KPIs, 90-day queue, drawer, status filters, column mapper; KPI cards filter queue + table
- File System Access API (Chrome/Edge): live file handle, **Refresh**, Auto-check while the tab is visible
- IndexedDB persistence of the file handle (re-permission on reopen when the browser allows)
- Fallback file picker + drag-drop for Safari/Firefox (refresh re-prompts)
- Excel lock banner on Windows when the .xlsx is open in Excel, with **Retry** and **Choose export copy**
- Vendored SheetJS (`vendor/xlsx.full.min.js`) + `sample-fleet.xlsx` / `sample-orders.xlsx` for practice

## Run

Static only — open `index.html` via a local server or `file://`. Chrome or Edge recommended for live Refresh.

GitHub Pages: publish from repository root (or `/docs`). Enable Pages after review CLEAR (deploy agent).

## Privacy

The workbook is read only in this browser on this computer. Data stays local (IndexedDB / localStorage) and is never uploaded to a server.
