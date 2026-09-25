# VelocityBench Dashboard (Fleet)

Local Excel to fleet KPIs and table. Open a workbook on this computer; the browser builds the board from your header row. Nothing is uploaded.

## Features

- Fleet layout: Unit# / Reg.Exp / 90-day inspection + registration KPIs, queue, drawer, status filters, column mapper
- Click-to-filter: KPI cards and status dropdown use the same predicates (counts match the list)
- Date horizons for **Inspection** and **Registration**: Overdue / 7 / 30 / 90 days (inclusive future windows; overdue separate)
- Export view CSV: currently visible/filtered rows only (client-side)
- Remember last workbook + view: sheet, filters, column map restored per workbook fingerprint (local only)

## Sample (sample-fleet.xlsx on 2026-09-25)

| KPI | Count |
|-----|------:|
| Units | 8 |
| Needs attention | 3 |
| Fleet OK | 5 |
| Inspection · Overdue | 2 |
| Inspection · 7 days | 2 |
| Inspection · 30 days | 4 |
| Inspection · 90 days | 6 |
| Registration · Overdue | 1 |
| Registration · 7 days | 1 |
| Registration · 30 days | 2 |
| Registration · 90 days | 4 |

## Run

Open index.html locally (Chrome/Edge recommended), or serve the folder statically.

## Privacy

Dashboard reads your workbook only in this browser. Data stays on this computer.
