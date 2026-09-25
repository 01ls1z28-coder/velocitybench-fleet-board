# Verify — KPI accuracy + Fleet-only

## KPI vs filter (sample-fleet.xlsx, today = 2026-09-25)

| KPI / filter | Expected | Units (insp days) |
|--------------|---------:|-------------------|
| Units | 8 | all |
| 90-day overdue | 2 | 108 (−7), 162 (−3) |
| Due in 7 days | 2 | 130 (2), 122 (7) |
| Due in 30 days | 4 | 130 (2), 122 (7), 155 (17), 101 (20) |
| Registration overdue | 1 | 122 (reg −10) |

Root cause fixed: KPI buckets were mutually exclusive (`else if`), so 0–7 day units were excluded from the 30-day card while the filter included them.

## Fleet-only

- No Generic layout button, board, or `generic.js`
- Load always enters Fleet (mapper when needed)

## Checks

- [ ] KPI card number equals filtered table/queue length for overdue, 7d, 30d, Units
- [ ] No "generic" controls in UI
- [ ] Offline twins: ASCII max ord 126; no readable `http`/`https`/`www` in source
