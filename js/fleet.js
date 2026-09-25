/* Fleet layout preset — v1 KPIs / queue / drawer / mapper + Phase 3 click-to-filter */
(function (global) {
  "use strict";

  const FIELDS = [
    { key: "id", label: "Unit#", aliases: ["unit#", "unit #", "unit no", "unit number", "unit"] },
    { key: "year", label: "Year", aliases: ["year"] },
    { key: "make", label: "MAKE/MODEL", aliases: ["make/model", "make model", "make", "model", "description"] },
    { key: "plate", label: "license#", aliases: ["license#", "license #", "license", "plate", "tag"] },
    { key: "vid", label: "Vehicle ID#", aliases: ["vehicle id#", "vehicle id", "veh id", "vin"] },
    { key: "reg", label: "Reg.Exp", aliases: ["reg.exp", "reg exp", "registration", "reg"] },
    { key: "insp", label: "90 day (insp. Due)", aliases: ["90 day", "insp", "inspection", "90 day insp"] },
    { key: "driver", label: "Driver", aliases: ["driver", "assigned", "operator"] },
    { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] }
  ];
  const MAP_KEY = "fleetboard-map-v3";
  const VIEW_KEY_PREFIX = "dashboard-fleet-view-v1:";

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function headerMatchesAlias(h, aliases) {
    const n = norm(h);
    return aliases.some((a) => {
      if (n === a) return true;
      if (a.length <= 3) return false;
      return n.includes(a);
    });
  }

  function looksLikeFleet(headers) {
    if (!headers || !headers.length) return false;
    let hits = 0;
    const needed = [
      ["unit#", "unit #", "unit no", "unit number", "unit"],
      ["reg exp", "reg.exp", "registration", "reg"],
      ["90 day", "insp", "inspection", "90 day insp"]
    ];
    needed.forEach((group) => {
      if (headers.some((h) => headerMatchesAlias(h, group))) hits += 1;
    });
    return hits >= 2;
  }

  function csvEscape(v) {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function create(api) {
    const state = {
      map: {},
      filter: "",
      search: "",
      selected: -1
    };

    function headers() {
      return api.getHeaders();
    }
    function rows() {
      return api.getRows();
    }

    function val(row, key) {
      return state.map[key] ? row[state.map[key]] : "";
    }

    function parseDate(v) {
      if (!v) return null;
      if (v instanceof Date && !isNaN(v)) return v;
      const d = new Date(String(v));
      return isNaN(d) ? null : d;
    }

    function daysUntil(d) {
      const a = new Date();
      a.setHours(0, 0, 0, 0);
      const b = new Date(d);
      b.setHours(0, 0, 0, 0);
      return Math.round((b - a) / 86400000);
    }

    function inspInfo(row) {
      const d = parseDate(val(row, "insp"));
      return d ? { date: d, n: daysUntil(d) } : null;
    }

    function regInfo(row) {
      const d = parseDate(val(row, "reg"));
      return d ? { date: d, n: daysUntil(d) } : null;
    }

    function tone(n) {
      return n < 0 ? "bad" : n <= 7 ? "warn" : n <= 30 ? "warn" : "good";
    }

    function daysLabel(n) {
      if (n < 0) return `${-n} days overdue`;
      if (n === 0) return "Due today";
      if (n === 1) return "Due tomorrow";
      return `${n} days left`;
    }

    function viewKey() {
      const fp = api.getFingerprint ? api.getFingerprint() : "";
      return fp ? VIEW_KEY_PREFIX + fp : null;
    }

    function persistView() {
      const key = viewKey();
      if (!key) return;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            layoutMode: "fleet",
            sheet: api.getSheet ? api.getSheet() : "",
            filter: state.filter,
            search: state.search
          })
        );
      } catch (_) { /* ignore */ }
    }

    function restoreView() {
      const key = viewKey();
      if (!key) return;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved.filter === "string") state.filter = saved.filter;
        if (typeof saved.search === "string") {
          state.search = saved.search;
          if ($("search")) $("search").value = state.search;
        }
        if ($("statusFilter")) $("statusFilter").value = state.filter;
      } catch (_) { /* ignore */ }
    }

    function guessMap() {
      const saved = JSON.parse(localStorage.getItem(MAP_KEY) || "{}");
      state.map = {};
      FIELDS.forEach((f) => {
        if (saved[f.key] && headers().includes(saved[f.key])) {
          state.map[f.key] = saved[f.key];
          return;
        }
        const exact = headers().find(
          (h) => norm(h) === norm(f.label) || f.aliases.includes(norm(h))
        );
        if (exact) {
          state.map[f.key] = exact;
          return;
        }
        state.map[f.key] =
          headers().find((h) => f.aliases.some((a) => norm(h).includes(a))) || "";
      });
    }

    function drawMapper() {
      $("mapGrid").innerHTML = FIELDS.map((f) => {
        const opts = [`<option value="">Not used</option>`]
          .concat(
            headers().map(
              (h) =>
                `<option value="${escapeAttr(h)}" ${
                  state.map[f.key] === h ? "selected" : ""
                }>${escapeHtml(h)}</option>`
            )
          )
          .join("");
        return `<label>${escapeHtml(f.label)}<select data-field="${f.key}">${opts}</select></label>`;
      }).join("");
      $("mapGrid").querySelectorAll("select").forEach((sel) => {
        sel.onchange = () => {
          state.map[sel.dataset.field] = sel.value;
        };
      });
    }

    function showMapper() {
      guessMap();
      drawMapper();
      $("setup").classList.remove("hidden");
      $("boardFleet").classList.add("hidden");
      document.querySelectorAll(".board-only").forEach((el) => el.classList.remove("hidden"));
      api.syncMenuMode("fleet");
    }

    function kpi(id, label, value, color, hint) {
      const active =
        (id === "fleet" && !state.filter) ||
        (id !== "fleet" && state.filter === id);
      return `<div class="kpi clickable${active ? " active" : ""}" data-kpi="${id}" role="button" tabindex="0">
      <div class="lbl">${label}</div>
      <div class="num" style="color:${color}">${value}</div>
      <div class="hint">${hint}</div>
    </div>`;
    }

    function matchesFilter(r, filter) {
      const insp = inspInfo(r);
      const reg = regInfo(r);
      if (!filter || filter === "fleet") return true;
      if (filter === "insp-overdue") return !!(insp && insp.n < 0);
      if (filter === "insp-week") return !!(insp && insp.n >= 0 && insp.n <= 7);
      if (filter === "insp-30") return !!(insp && insp.n >= 0 && insp.n <= 30);
      if (filter === "reg-overdue") return !!(reg && reg.n < 0);
      if (filter === "missing") return !insp;
      return true;
    }

    function setFilter(next) {
      /* click again clears */
      if (state.filter === next || (next === "" && !state.filter)) {
        state.filter = "";
      } else {
        state.filter = next || "";
      }
      if ($("statusFilter")) $("statusFilter").value = state.filter;
      persistView();
      renderQueue();
      renderTable();
      syncKpiActive();
    }

    function syncKpiActive() {
      $("kpis").querySelectorAll(".kpi").forEach((k) => {
        const id = k.dataset.kpi;
        const on =
          (id === "fleet" && !state.filter) ||
          (id !== "fleet" && state.filter === id);
        k.classList.toggle("active", on);
      });
    }

    function renderQueue() {
      const queue = [];
      rows().forEach((r, idx) => {
        if (!matchesFilter(r, state.filter)) return;
        const insp = inspInfo(r);
        if (!insp) return;
        /* when no bucket filter, keep 45-day queue spirit; when filtered, show matching with dates */
        if (!state.filter && insp.n > 45) return;
        if (state.filter === "insp-overdue" || state.filter === "insp-week" || state.filter === "insp-30") {
          queue.push({ idx, r, insp });
        } else if (!state.filter) {
          queue.push({ idx, r, insp });
        } else if (insp) {
          queue.push({ idx, r, insp });
        }
      });
      queue.sort((a, b) => a.insp.n - b.insp.n);

      const titleHint = state.filter
        ? ` · filtered: ${
            state.filter === "insp-overdue"
              ? "overdue"
              : state.filter === "insp-week"
                ? "7 days"
                : state.filter === "insp-30"
                  ? "30 days"
                  : state.filter
          }`
        : "";
      const h3 = $("dueList").parentElement.querySelector("h3");
      if (h3) h3.textContent = "90-day inspection queue" + titleHint;

      $("dueList").innerHTML =
        queue
          .slice(0, 12)
          .map(
            ({ idx, r, insp }) => `
        <div class="q-item" data-idx="${idx}">
          <div class="days ${tone(insp.n)}">${
            insp.n < 0 ? "OVERDUE" : insp.n + "d"
          }</div>
          <div>
            <b>Unit ${escapeHtml(String(val(r, "id") || "—"))}</b>
            <div class="meta">${escapeHtml(String(val(r, "make") || ""))}</div>
          </div>
          <div class="meta">${escapeHtml(String(val(r, "driver") || "No driver"))}</div>
          <div class="meta">${insp.date.toLocaleDateString()}<br>${daysLabel(
              insp.n
            )}</div>
        </div>`
          )
          .join("") ||
        `<div class="meta" style="padding:8px 0">${
          state.filter
            ? "No units match this filter."
            : "No inspections due in the next 45 days."
        }</div>`;
      $("dueList").querySelectorAll(".q-item").forEach((el) => {
        el.onclick = () => openRow(+el.dataset.idx);
      });
    }

    function buildBoard() {
      localStorage.setItem(MAP_KEY, JSON.stringify(state.map));
      restoreView();
      $("setup").classList.add("hidden");
      $("boardFleet").classList.remove("hidden");
      document.querySelectorAll(".board-only").forEach((el) => el.classList.remove("hidden"));
      api.updateLiveMeta("fleet");
      api.syncMenuMode("fleet");

      /* KPI counts MUST match matchesFilter / statusFilter predicates so card
         numbers equal the filtered list length. Future horizons are inclusive
         and overlapping (7-day is a subset of 30-day); overdue is separate. */
      let overdue = 0,
        week = 0,
        thirty = 0,
        missing = 0,
        regOver = 0;
      rows().forEach((r) => {
        const insp = inspInfo(r);
        if (!insp) missing += 1;
        if (matchesFilter(r, "insp-overdue")) overdue += 1;
        if (matchesFilter(r, "insp-week")) week += 1;
        if (matchesFilter(r, "insp-30")) thirty += 1;
        if (matchesFilter(r, "reg-overdue")) regOver += 1;
      });

      $("kpis").innerHTML = [
        kpi(
          "fleet",
          "Units",
          rows().length,
          "var(--soft)",
          `${regOver} registration${regOver === 1 ? "" : "s"} overdue · click = all`
        ),
        kpi(
          "insp-overdue",
          "90-day overdue",
          overdue,
          overdue ? "var(--red)" : "var(--good)",
          "Click to filter queue + table"
        ),
        kpi(
          "insp-week",
          "Due in 7 days",
          week,
          week ? "var(--warn)" : "var(--accent)",
          "Click to filter queue + table"
        ),
        kpi(
          "insp-30",
          "Due in 30 days",
          thirty,
          thirty ? "var(--warn)" : "var(--accent)",
          "Click to filter queue + table"
        )
      ].join("");
      $("kpis").querySelectorAll(".kpi").forEach((el) => {
        el.onclick = () => {
          const id = el.dataset.kpi;
          setFilter(id === "fleet" ? "" : id);
        };
      });

      renderQueue();
      renderTable();
      persistView();
    }

    function visibleRows() {
      const q = norm(state.search);
      return rows()
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => {
          if (!matchesFilter(r, state.filter)) return false;
          if (!q) return true;
          return ["id", "year", "make", "plate", "vid", "driver", "notes"].some((k) =>
            norm(val(r, k)).includes(q)
          );
        })
        .sort((a, b) => {
          const an = inspInfo(a.r),
            bn = inspInfo(b.r);
          if (!an && !bn) return 0;
          if (!an) return 1;
          if (!bn) return -1;
          return an.n - bn.n;
        });
    }

    function renderTable() {
      const cols = ["id", "insp", "year", "make", "driver", "reg", "plate", "vid", "notes"].filter(
        (k) => state.map[k]
      );
      const labels = {
        id: "Unit#",
        year: "Year",
        make: "MAKE/MODEL",
        plate: "License#",
        vid: "Vehicle ID#",
        reg: "Reg. Exp",
        insp: "90 Day Insp.",
        driver: "Driver",
        notes: "Notes"
      };
      const list = visibleRows();
      $("thead").innerHTML =
        "<tr>" + cols.map((k) => `<th>${labels[k]}</th>`).join("") + "</tr>";
      $("tbody").innerHTML = list
        .map(({ r, idx }) => {
          const cells = cols
            .map((k) => {
              if (k === "insp" || k === "reg") {
                const info = k === "insp" ? inspInfo(r) : regInfo(r);
                if (!info)
                  return `<td><span class="chip muted">No date</span></td>`;
                return `<td><span class="chip ${tone(
                  info.n
                )}">${info.date.toLocaleDateString()}</span><div class="meta">${daysLabel(
                  info.n
                )}</div></td>`;
              }
              if (k === "make")
                return `<td class="wrap">${escapeHtml(String(val(r, k) || "—"))}</td>`;
              if (k === "notes")
                return `<td class="notes">${escapeHtml(String(val(r, k) || "—"))}</td>`;
              return `<td>${escapeHtml(String(val(r, k) || "—"))}</td>`;
            })
            .join("");
          return `<tr data-idx="${idx}" class="${
            state.selected === idx ? "active" : ""
          }">${cells}</tr>`;
        })
        .join("");
      $("tbody").querySelectorAll("tr").forEach((tr) => {
        tr.onclick = () => openRow(+tr.dataset.idx);
      });
    }

    function openRow(idx) {
      const r = rows()[idx];
      if (!r) return;
      state.selected = idx;
      renderTable();
      const insp = inspInfo(r);
      const badge = !insp
        ? ["muted", "No 90-day date"]
        : [tone(insp.n), daysLabel(insp.n)];
      const fields = [
        ["Year", val(r, "year")],
        ["MAKE/MODEL", val(r, "make")],
        ["License#", val(r, "plate")],
        ["Vehicle ID#", val(r, "vid")],
        [
          "90 Day Insp.",
          insp ? `${insp.date.toLocaleDateString()} · ${daysLabel(insp.n)}` : ""
        ],
        ["Reg. Exp", (() => {
          const d = parseDate(val(r, "reg"));
          return d ? d.toLocaleDateString() : val(r, "reg");
        })()],
        ["Driver", val(r, "driver") || "Unassigned"],
        ["Notes", val(r, "notes")]
      ].filter(([, v]) => v);
      $("drawer").innerHTML = `
      <button class="icon-btn" id="closeDrawer" type="button" style="float:right" aria-label="Close">✕</button>
      <div class="chip ${badge[0]}">${badge[1]}</div>
      <h2>Unit ${escapeHtml(String(val(r, "id") || ""))}</h2>
      <div class="kv">${fields
        .map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`)
        .join("")}</div>`;
      $("drawer").classList.add("open");
      $("backdrop").classList.remove("hidden");
      $("closeDrawer").onclick = closeDrawer;
    }

    function closeDrawer() {
      $("drawer").classList.remove("open");
      $("backdrop").classList.add("hidden");
    }

    function exportCurrentView() {
      const cols = ["id", "insp", "year", "make", "driver", "reg", "plate", "vid", "notes"].filter(
        (k) => state.map[k]
      );
      const labels = {
        id: "Unit#",
        year: "Year",
        make: "MAKE/MODEL",
        plate: "License#",
        vid: "Vehicle ID#",
        reg: "Reg. Exp",
        insp: "90 Day Insp.",
        driver: "Driver",
        notes: "Notes"
      };
      const list = visibleRows();
      const lines = [];
      lines.push(cols.map((k) => csvEscape(labels[k])).join(","));
      list.forEach(({ r }) => {
        lines.push(
          cols
            .map((k) => {
              if (k === "insp" || k === "reg") {
                const info = k === "insp" ? inspInfo(r) : regInfo(r);
                return csvEscape(info ? info.date.toISOString().slice(0, 10) : "");
              }
              return csvEscape(val(r, k));
            })
            .join(",")
        );
      });
      const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      const base = (api.getFileName && api.getFileName()) || "fleet-view";
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(blob);
      a.download = base.replace(/\.[^.]+$/, "") + `-view-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    }

    function wire() {
      $("applyMap").onclick = () => {
        buildBoard();
      };
      $("remapBtn").onclick = () => {
        showMapper();
      };
      $("search").oninput = () => {
        state.search = $("search").value;
        persistView();
        renderTable();
      };
      $("statusFilter").onchange = () => {
        state.filter = $("statusFilter").value;
        persistView();
        renderQueue();
        renderTable();
        syncKpiActive();
      };
      $("backdrop").onclick = closeDrawer;
      $("sheetSelectFleet").onchange = () => {
        api.useSheet($("sheetSelectFleet").value);
        guessMap();
        drawMapper();
      };
    }

    function activate({ skipMapper }) {
      guessMap();
      if (skipMapper) {
        buildBoard();
      } else {
        drawMapper();
        showMapper();
      }
    }

    function refresh() {
      if ($("boardFleet").classList.contains("hidden") && $("setup").classList.contains("hidden"))
        return;
      if (!$("setup").classList.contains("hidden")) {
        guessMap();
        drawMapper();
        return;
      }
      buildBoard();
    }

    wire();

    return {
      FIELDS,
      looksLikeFleet,
      activate,
      refresh,
      showMapper,
      buildBoard,
      guessMap,
      closeDrawer,
      exportCurrentView,
      persistView
    };
  }

  global.FleetBoardFleet = { FIELDS, looksLikeFleet, create, MAP_KEY };
})(window);
