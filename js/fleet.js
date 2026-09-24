/* Fleet Board preset — v1 KPIs / queue / drawer / mapper (optional layout) */
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
      /* short aliases (reg, vin) must be exact — avoid "reg"→"region" */
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
      $("boardGeneric").classList.add("hidden");
    }

    function kpi(id, label, value, color, hint) {
      return `<div class="kpi" data-kpi="${id}">
      <div class="lbl">${label}</div>
      <div class="num" style="color:${color}">${value}</div>
      <div class="hint">${hint}</div>
    </div>`;
    }

    function buildBoard() {
      localStorage.setItem(MAP_KEY, JSON.stringify(state.map));
      $("setup").classList.add("hidden");
      $("boardFleet").classList.remove("hidden");
      $("boardGeneric").classList.add("hidden");
      $("menuBtn").classList.remove("hidden");
      api.updateLiveMeta("fleet");
      api.syncMenuMode("fleet");

      let overdue = 0,
        week = 0,
        thirty = 0,
        missing = 0,
        regOver = 0;
      const queue = [];
      rows().forEach((r, idx) => {
        const insp = inspInfo(r);
        const reg = regInfo(r);
        if (!insp) missing += 1;
        else {
          if (insp.n < 0) overdue += 1;
          else if (insp.n <= 7) week += 1;
          else if (insp.n <= 30) thirty += 1;
          if (insp.n <= 45) queue.push({ idx, r, insp });
        }
        if (reg && reg.n < 0) regOver += 1;
      });
      queue.sort((a, b) => a.insp.n - b.insp.n);

      $("kpis").innerHTML = [
        kpi(
          "fleet",
          "Units",
          rows().length,
          "var(--soft)",
          `${regOver} registration${regOver === 1 ? "" : "s"} overdue`
        ),
        kpi(
          "insp-overdue",
          "90-day overdue",
          overdue,
          overdue ? "var(--red)" : "var(--good)",
          "Inspection past due"
        ),
        kpi(
          "insp-week",
          "Due in 7 days",
          week,
          week ? "var(--warn)" : "var(--accent)",
          "Act this week"
        ),
        kpi(
          "insp-30",
          "Due in 30 days",
          thirty,
          thirty ? "var(--warn)" : "var(--accent)",
          "On the 90-day horizon"
        )
      ].join("");
      $("kpis").querySelectorAll(".kpi").forEach((el) => {
        el.onclick = () => {
          state.filter = el.dataset.kpi === "fleet" ? "" : el.dataset.kpi;
          $("statusFilter").value = state.filter;
          renderTable();
          $("kpis")
            .querySelectorAll(".kpi")
            .forEach((k) =>
              k.classList.toggle("active", k.dataset.kpi === el.dataset.kpi)
            );
        };
      });

      $("dueList").innerHTML =
        queue
          .slice(0, 8)
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
        `<div class="meta" style="padding:8px 0">No inspections due in the next 45 days.</div>`;
      $("dueList").querySelectorAll(".q-item").forEach((el) => {
        el.onclick = () => openRow(+el.dataset.idx);
      });
      renderTable();
    }

    function visibleRows() {
      const q = norm(state.search);
      return rows()
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => {
          const insp = inspInfo(r);
          const reg = regInfo(r);
          if (state.filter === "insp-overdue" && !(insp && insp.n < 0)) return false;
          if (state.filter === "insp-week" && !(insp && insp.n >= 0 && insp.n <= 7))
            return false;
          if (state.filter === "insp-30" && !(insp && insp.n >= 0 && insp.n <= 30))
            return false;
          if (state.filter === "reg-overdue" && !(reg && reg.n < 0)) return false;
          if (state.filter === "missing" && insp) return false;
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

    function wire() {
      $("applyMap").onclick = () => {
        buildBoard();
      };
      $("remapBtn").onclick = () => {
        $("menu").classList.add("hidden");
        showMapper();
      };
      $("remapBoardBtn").onclick = () => showMapper();
      $("search").oninput = () => {
        state.search = $("search").value;
        renderTable();
      };
      $("statusFilter").onchange = () => {
        state.filter = $("statusFilter").value;
        renderTable();
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
      closeDrawer
    };
  }

  global.FleetBoardFleet = { FIELDS, looksLikeFleet, create, MAP_KEY };
})(window);
