# VelocityBench Dashboard (Fleet)

Local Excel to fleet KPIs and table. Open a workbook on this computer; the browser builds the board from your header row. Nothing is uploaded.

## Features

- Fleet layout: Unit# / Reg.Exp / 90-day inspection KPIs, inspection queue, drawer, status filters, column mapper
- Click-to-filter: KPI cards and status dropdown use the same predicates (counts match the list)
- Date horizons: Overdue / Due in 7 days / Due in 30 days (inclusive future windows; overdue separate)
- Export view CSV: currently visible/filtered rows only (client-side)
- Remember last workbook + view: sheet, filters, column map restored per workbook fingerprint (local only)

## Sample (sample-fleet.xlsx on 2026-09-25)

| KPI | Count |
|-----|------:|
| Units | 8 |
| 90-day overdue | 2 |
| Due in 7 days | 2 |
| Due in 30 days | 4 |
| Registration overdue (Units hint) | 1 |

## Run

Open index.html locally (Chrome/Edge recommended), or serve the folder statically.

## Privacy

Dashboard reads your workbook only in this browser. Data stays on this computer.
