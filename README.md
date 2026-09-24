# VelocityBench Fleet Board

Local Excel → flexible dashboard. Open any workbook on this computer; the browser builds KPIs and a table from your **header row**. **Nothing is uploaded.**

**Created by Jorge Guerra.**

## Live (after Pages deploy)

https://01ls1z28-coder.github.io/velocitybench-fleet-board/

Hub: [velocitybench.com](https://velocitybench.com/) · Bench: [velocitybench.com/bench/](https://velocitybench.com/bench/)

## Features

- **Generic layout (default):** any `.xlsx` / `.xls` / `.csv` → inferred column types, auto KPIs, searchable/sortable table, column show/hide
- **Fleet Board preset (optional):** detect Unit# / Reg.Exp / 90-day headers → v1 KPIs, 90-day queue, drawer, status filters, column mapper
- File System Access API (Chrome/Edge): live file handle, **Refresh**, Auto-check while the tab is visible
- IndexedDB persistence of the file handle (re-permission on reopen when the browser allows)
- Fallback file picker + drag-drop for Safari/Firefox (refresh re-prompts)
- Excel lock banner on Windows when the .xlsx is open in Excel, with **Retry** and **Choose export copy**
- Vendored SheetJS (`vendor/xlsx.full.min.js`) + `sample-fleet.xlsx` / `sample-orders.xlsx` for practice

## Run

Static only — open `index.html` via a local server or `file://`. Chrome or Edge recommended for live Refresh.

GitHub Pages: publish from repository root (or `/docs`). Enable Pages after review CLEAR (deploy agent).

## Privacy

The workbook is read only in this browser on this computer. Data stays local and is never uploaded to a server.
