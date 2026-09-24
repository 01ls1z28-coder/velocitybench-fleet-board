/* VelocityBench Dashboard — shell: FSA, IndexedDB, mode routing */
(function () {
  "use strict";

  const IDB_NAME = "fleetboard-fsa-v1";
  const IDB_STORE = "handles";
  const IDB_KEY = "workbook";
  const POLL_MS = 4000;
  const MODE_KEY_PREFIX = FleetBoardGeneric.MODE_KEY_PREFIX;
  const DISMISS_KEY_PREFIX = "fleetboard-fleet-dismiss-v1:";

  const state = {
    wb: null,
    rows: [],
    headers: [],
    sheet: "",
    mode: "generic", /* generic | fleet */
    fileHandle: null,
    fileName: "",
    lastModified: 0,
    supportsFsa: typeof window.showOpenFilePicker === "function",
    autoCheck: true,
    pollTimer: null,
    locked: false,
    headerHash: ""
  };

  const $ = (id) => document.getElementById(id);

  /* ── IndexedDB handle persist ── */
  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSetHandle(handle) {
    try {
      const db = await idbOpen();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) { /* graceful */ }
  }

  async function idbGetHandle() {
    try {
      const db = await idbOpen();
      const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return handle || null;
    } catch (_) {
      return null;
    }
  }

  async function idbClearHandle() {
    try {
      const db = await idbOpen();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) { /* graceful */ }
  }

  async function ensurePermission(handle, mode) {
    if (!handle || !handle.queryPermission) return false;
    try {
      let status = await handle.queryPermission({ mode: mode || "read" });
      if (status === "granted") return true;
      status = await handle.requestPermission({ mode: mode || "read" });
      return status === "granted";
    } catch (_) {
      return false;
    }
  }

  /* ── UI helpers ── */
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function setLockBanner(show) {
    state.locked = !!show;
    $("lockBanner").classList.toggle("hidden", !show);
  }

  function setFsaHint(show) {
    $("fsaHint").classList.toggle("hidden", !show);
  }

  function setFleetSuggest(show) {
    $("fleetSuggest").classList.toggle("hidden", !show);
  }

  function updateLiveMeta(which) {
    const nameId = which === "fleet" ? "fileNameFleet" : "fileNameGeneric";
    const hintId = which === "fleet" ? "fileHintFleet" : "fileHintGeneric";
    $(nameId).textContent = state.fileName || "Workbook";
    let hint = "Local workbook";
    if (state.supportsFsa && state.fileHandle) {
      hint = "Live file handle · Chrome/Edge Refresh";
    } else if (state.fileName) {
      hint = "Fallback mode · re-choose file to refresh";
    }
    $(hintId).textContent = hint;
    /* keep both in sync */
    $("fileNameFleet").textContent = state.fileName || "Workbook";
    $("fileNameGeneric").textContent = state.fileName || "Workbook";
    $("fileHintFleet").textContent = hint;
    $("fileHintGeneric").textContent = hint;
  }

  function syncMenuMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".fleet-only").forEach((el) => {
      el.classList.toggle("hidden", mode !== "fleet");
    });
    document.querySelectorAll(".generic-only").forEach((el) => {
      el.classList.toggle("hidden", mode !== "generic");
    });
  }

  function saveModePreference(mode) {
    if (!state.headerHash) return;
    try {
      localStorage.setItem(MODE_KEY_PREFIX + state.headerHash, mode);
    } catch (_) { /* ignore */ }
  }

  function loadModePreference() {
    if (!state.headerHash) return null;
    try {
      return localStorage.getItem(MODE_KEY_PREFIX + state.headerHash);
    } catch (_) {
      return null;
    }
  }

  function wasDismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY_PREFIX + state.headerHash) === "1";
    } catch (_) {
      return false;
    }
  }

  function setDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + state.headerHash, "1");
    } catch (_) { /* ignore */ }
  }

  function showToastUpdated() {
    toast("Updated — refreshed");
  }

  /* ── Shared API for modules ── */
  const api = {
    getHeaders: () => state.headers,
    getRows: () => state.rows,
    updateLiveMeta,
    syncMenuMode,
    useSheet,
    afterSheetChange: () => {
      state.headerHash = FleetBoardGeneric.headerHash(state.headers);
      maybeSuggestFleet();
    }
  };

  const fleet = FleetBoardFleet.create(api);
  const generic = FleetBoardGeneric.create(api);

  /* ── File pick / load ── */
  async function pickWithFsa() {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: "Excel / CSV",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          "application/vnd.ms-excel": [".xls", ".xlsm"],
          "text/csv": [".csv"]
        }
      }],
      excludeAcceptAllOption: false
    });
    state.fileHandle = handle;
    await idbSetHandle(handle);
    setFsaHint(false);
    await loadFromHandle(handle, { silent: false });
  }

  function pickWithInput() {
    $("file").value = "";
    $("file").click();
  }

  async function pickFile() {
    if (state.supportsFsa) {
      try {
        await pickWithFsa();
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    pickWithInput();
  }

  async function loadFromHandle(handle, opts) {
    opts = opts || {};
    try {
      const file = await handle.getFile();
      setLockBanner(false);
      state.fileName = file.name;
      state.lastModified = file.lastModified;
      updateLiveMeta(state.mode);
      const buf = await file.arrayBuffer();
      await parseWorkbook(buf, { toastOnSuccess: !!opts.toastOnSuccess });
      startPoll();
      return true;
    } catch (err) {
      setLockBanner(true);
      return false;
    }
  }

  function loadFileBlob(file) {
    state.fileHandle = null;
    state.fileName = file.name || "workbook";
    state.lastModified = file.lastModified || 0;
    updateLiveMeta(state.mode);
    setFsaHint(!state.supportsFsa);
    const reader = new FileReader();
    reader.onload = (e) => {
      parseWorkbook(e.target.result, {}).catch((err) => {
        alert("Could not read that file.\n" + (err && err.message ? err.message : err));
      });
    };
    reader.onerror = () => {
      setLockBanner(true);
    };
    reader.readAsArrayBuffer(file);
  }

  function fillSheetSelects() {
    const opts = state.wb.SheetNames.map(
      (n) => `<option value="${n.replace(/"/g, "&quot;")}">${n.replace(/</g, "&lt;")}</option>`
    ).join("");
    $("sheetSelectGeneric").innerHTML = opts;
    $("sheetSelectFleet").innerHTML = opts;
    $("sheetSelectGeneric").value = state.sheet;
    $("sheetSelectFleet").value = state.sheet;
  }

  async function parseWorkbook(buf, opts) {
    opts = opts || {};
    try {
      state.wb = XLSX.read(buf, { type: "array", cellDates: true });
      $("loader").classList.add("hidden");
      setLockBanner(false);
      const keepSheet =
        state.sheet && state.wb.SheetNames.includes(state.sheet)
          ? state.sheet
          : state.wb.SheetNames[0];
      useSheet(keepSheet);
      fillSheetSelects();
      routeAfterLoad();
      if (opts.toastOnSuccess) showToastUpdated();
    } catch (err) {
      alert("Could not read that file.\n" + (err && err.message ? err.message : err));
      throw err;
    }
  }

  function useSheet(name) {
    state.sheet = name;
    const data = XLSX.utils.sheet_to_json(state.wb.Sheets[name], {
      header: 1,
      defval: "",
      raw: false
    });
    const headerIdx = data.findIndex((r) => r.some((c) => String(c).trim() !== ""));
    if (headerIdx < 0) {
      state.headers = [];
      state.rows = [];
      state.headerHash = "";
      return;
    }
    state.headers = data[headerIdx].map((h) => String(h).trim());
    state.rows = data
      .slice(headerIdx + 1)
      .filter((r) => r.some((c) => String(c).trim() !== ""))
      .map((r) => {
        const o = {};
        state.headers.forEach((h, i) => {
          o[h] = r[i] == null ? "" : r[i];
        });
        return o;
      });
    state.headerHash = FleetBoardGeneric.headerHash(state.headers);
  }

  function maybeSuggestFleet() {
    const isFleet = FleetBoardFleet.looksLikeFleet(state.headers);
    if (
      state.mode === "generic" &&
      isFleet &&
      loadModePreference() !== "fleet" &&
      !wasDismissed()
    ) {
      setFleetSuggest(true);
    } else {
      setFleetSuggest(false);
    }
  }

  function routeAfterLoad() {
    const pref = loadModePreference();
    const isFleet = FleetBoardFleet.looksLikeFleet(state.headers);

    if (pref === "fleet" && isFleet) {
      enterFleet({ skipMapper: true });
      setFleetSuggest(false);
      return;
    }

    /* Default: generic — even on fleet files until user opts in */
    enterGeneric();
    maybeSuggestFleet();
  }

  function enterGeneric() {
    state.mode = "generic";
    saveModePreference("generic");
    setFleetSuggest(false);
    fleet.closeDrawer();
    generic.build();
  }

  function enterFleet(opts) {
    opts = opts || {};
    state.mode = "fleet";
    saveModePreference("fleet");
    setFleetSuggest(false);
    fleet.activate({ skipMapper: !!opts.skipMapper });
  }

  async function refreshWorkbook() {
    if (state.fileHandle) {
      const okPerm = await ensurePermission(state.fileHandle, "read");
      if (!okPerm) {
        setFsaHint(true);
        toast("Permission needed — choose the workbook again");
        return;
      }
      const ok = await loadFromHandle(state.fileHandle, {
        toastOnSuccess: true,
        silent: false
      });
      if (!ok) return;
      return;
    }
    setFsaHint(true);
    toast("This browser can’t keep a live file handle — choose the workbook again");
    pickWithInput();
  }

  function chooseExportCopy() {
    pickFile();
  }

  /* ── Auto-check poll ── */
  function stopPoll() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function startPoll() {
    stopPoll();
    if (!state.autoCheck || !state.fileHandle) return;
    state.pollTimer = setInterval(pollTick, POLL_MS);
  }

  async function pollTick() {
    if (!state.autoCheck || !state.fileHandle) return;
    if (document.visibilityState !== "visible") return;
    try {
      const file = await state.fileHandle.getFile();
      setLockBanner(false);
      if (file.lastModified !== state.lastModified) {
        state.lastModified = file.lastModified;
        state.fileName = file.name;
        updateLiveMeta(state.mode);
        const buf = await file.arrayBuffer();
        await parseWorkbook(buf, { toastOnSuccess: true });
      }
    } catch (_) {
      setLockBanner(true);
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (state.autoCheck && state.fileHandle) startPoll();
    } else {
      stopPoll();
    }
  });

  function setAutoCheck(on) {
    state.autoCheck = !!on;
    $("autoCheckGeneric").checked = state.autoCheck;
    $("autoCheckFleet").checked = state.autoCheck;
    if (state.autoCheck) startPoll();
    else stopPoll();
  }

  /* ── Wire UI ── */
  $("pickBtn").onclick = () => pickFile();
  $("file").onchange = (e) => {
    if (e.target.files[0]) {
      state.fileHandle = null;
      loadFileBlob(e.target.files[0]);
    }
  };
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
    })
  );
  drop.addEventListener("drop", (e) => {
    if (e.dataTransfer.files[0]) {
      state.fileHandle = null;
      loadFileBlob(e.dataTransfer.files[0]);
    }
  });

  $("menuBtn").onclick = () => $("menu").classList.toggle("hidden");
  $("chooseOtherBtn").onclick = async () => {
    $("menu").classList.add("hidden");
    await idbClearHandle();
    state.fileHandle = null;
    stopPoll();
    location.reload();
  };
  $("chooseExportBtn").onclick = () => {
    $("menu").classList.add("hidden");
    chooseExportCopy();
  };
  $("useFleetBtn").onclick = () => {
    $("menu").classList.add("hidden");
    enterFleet({ skipMapper: false });
  };
  $("useGenericBtn").onclick = () => {
    $("menu").classList.add("hidden");
    enterGeneric();
  };
  $("setupGenericBtn").onclick = () => enterGeneric();
  $("switchGenericFromFleet").onclick = () => enterGeneric();
  $("acceptFleetBtn").onclick = () => enterFleet({ skipMapper: false });
  $("dismissFleetBtn").onclick = () => {
    setDismissed();
    setFleetSuggest(false);
  };

  $("refreshBtnGeneric").onclick = () => refreshWorkbook();
  $("refreshBtnFleet").onclick = () => refreshWorkbook();
  $("lockRetryBtn").onclick = () => refreshWorkbook();
  $("lockExportBtn").onclick = () => chooseExportCopy();
  $("fsaRepickBtn").onclick = () => pickFile();
  $("autoCheckGeneric").onchange = (e) => setAutoCheck(e.target.checked);
  $("autoCheckFleet").onchange = (e) => setAutoCheck(e.target.checked);

  document.addEventListener("click", (e) => {
    if (!$("menu").contains(e.target) && e.target !== $("menuBtn")) {
      $("menu").classList.add("hidden");
    }
  });

  /* Restore FSA handle on load when possible */
  (async function restoreHandle() {
    if (!state.supportsFsa) return;
    const handle = await idbGetHandle();
    if (!handle) return;
    const ok = await ensurePermission(handle, "read");
    if (!ok) return;
    state.fileHandle = handle;
    await loadFromHandle(handle, { silent: true });
  })();
})();
