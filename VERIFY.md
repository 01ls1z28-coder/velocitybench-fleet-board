# Verify - KPI boxes (Inspection + Registration) + Fleet-only

## KPI vs filter (sample-fleet.xlsx, today = 2026-09-25)

Inclusive overlapping future horizons; overdue separate. Counts use the same `matchesFilter` predicates as the status dropdown.

| KPI / filter key | Expected | Matching units |
|------------------|---------:|----------------|
| Units | 8 | all |
| needs-attention | 3 | 108, 122, 162 (insp or reg overdue) |
| fleet-ok | 5 | has insp/reg date and not overdue (disjoint) |
| no-dates | 0 | both insp and reg missing/unparseable |
| insp-overdue | 2 | 108 (−7), 162 (−3) |
| insp-week | 2 | 130 (2), 122 (7) |
| insp-30 | 4 | 130 (2), 122 (7), 155 (17), 101 (20) |
| insp-60 | 5 | +114 (43); excludes 141 (69) |
| insp-90 | 6 | +114 (43), 141 (69) |
| reg-overdue | 1 | 122 (reg −10) |
| reg-week | 1 | 155 (reg 4) |
| reg-30 | 2 | 155 (4), 108 (11) |
| reg-60 | 3 | +130 (32); excludes 162 (89) |
| reg-90 | 4 | +130 (32), 162 (89) |
| missing | 0 | - |

## Layout

- Row 1: Units | Needs attention | Fleet OK | No dates (fixed; not in slots; disjoint buckets)
- Group **Inspection**: Overdue / 7 / 30 / 60 / 90 days (own slot row)
- Group **Registration**: Overdue / 7 / 30 / 60 / 90 days (own slot row)
- Labels legible (category + horizon); dark theme

## Fleet-only

- No Generic layout button, board, or `generic.js`
- Load always enters Fleet (mapper when needed)

## Checks

- [ ] KPI card number equals filtered table/queue length for every key above
- [ ] Queue title names Needs attention / Fleet OK / No dates / Inspection / Registration correctly when filtered
- [ ] No "generic" controls in UI
- [ ] Offline twins: ASCII max ord 126; no CDN/`fetch(`/`script src=`; OOXML `http://schemas...` literals OK

## All columns (2026-09-25)

Table shows every non-blank workbook header; KPIs remain mapped insp/reg via `matchesFilter`. Queue uncapped (`Showing N`). Offline twins ASCII max ord 126; OOXML namespace literals OK. See `/workspace/dashboard-kpi-fix/ALL-COLUMNS.md`.

## Column sort (2026-09-25)

Click any fleet table `<th>` to sort visible/filtered rows. Same header toggles asc/desc; different header starts ascending. Indicators: ASCII `^` / `v`. Mapped insp/reg sort by days-until; year/numbers numeric; other dates via parseDate; else case-insensitive string. Sort key+dir persisted in `dashboard-fleet-view-v1:` localStorage. Default (no sortKey): inspection days ascending. See `/workspace/dashboard-kpi-fix/COLUMN-SORT.md`.

## Customize layout (2026-09-25)

**Customize** opens a local panel to show/hide KPI cards, table columns, and due queue. Persisted in `dashboard-fleet-view-v1:` with sort. Defaults = full layout. Local-only / no Pages push until approved. See `/workspace/dashboard-kpi-fix/CUSTOMIZE-LAYOUT.md`.


## 60-day + drag reorder + brass (2026-09-25)

`insp-60` / `reg-60` inclusive horizons; unified KPI strip with drag-snap order in `kpiOrder`; brass chrome. Local-only / no Pages push. See `/workspace/dashboard-kpi-fix/KPI-60-DND.md`.


## Theme + Units strip (2026-09-25)

Default Dark (prior look). Optional Dark + Brass trim accents only. Theme picker in Customize + Theme select; persist `theme` with layout. Units fixed on top + divider; draggable strip excludes Units. Status red/warn/good clear in every theme. Local-only / no Pages push. See `/workspace/dashboard-kpi-fix/THEME-TRIM.md`.
