# VelocityBench Fleet Board

Local Excel → fleet dashboard. Open a workbook on this computer; the browser reads it in place. **Nothing is uploaded.**

**Created by Jorge Guerra.**

## Live (after Pages deploy)

https://01ls1z28-coder.github.io/velocitybench-fleet-board/

Hub: [velocitybench.com](https://velocitybench.com/) · Bench: [velocitybench.com/bench/](https://velocitybench.com/bench/)

## Features

- File System Access API (Chrome/Edge): keep a live file handle, **Refresh**, and optional auto-check while the tab is visible
- IndexedDB persistence of the file handle (re-permission on reopen when the browser allows)
- Fallback file picker + drag-drop for Safari/Firefox (refresh re-prompts)
- Excel lock banner on Windows when the .xlsx is open in Excel, with **Retry** and **Choose export copy**
- Column mapper (aliases + `localStorage` map key `fleetboard-map-v3`)
- KPIs, 90-day due queue (≤45 days), search/filters, unit drawer
- Vendored SheetJS (`vendor/xlsx.full.min.js`) + `sample-fleet.xlsx` for practice

## Expected columns

Unit#, Year, MAKE/MODEL, license#, Vehicle ID#, Reg.Exp, 90 day (insp. Due), Driver, Notes

## Run

Static only — open `index.html` via a local server or `file://`. Chrome or Edge recommended for live Refresh.

GitHub Pages: publish from repository root (or `/docs`). Enable Pages after review CLEAR (deploy agent).

## Privacy

The workbook is read only in this browser on this computer. Data stays local and is never uploaded to a server.
