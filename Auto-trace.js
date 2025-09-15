(async () => {
  // =========================================================
  // Auto-trace v2  •  unified style
  // =========================================================

  const NS = 'Auto-trace v2';
  const state = (window[NS] ||= {
    timers: new Set(),
    progress: null,
    didScrollDown: false,
    stop: false,
    _suppressNextNotify: false,
  });

  const CFG = {
    LIMIT: 20,
    UI: {
      Z: 999999,
      COLORS: { success: '#52c41a', error: '#ff4d4f', warn: '#faad14', info: '#3498db' },
      DURATION: 2000,
    },
    SELECTORS: {
      scrollable: ['.dscCanvas'],
      count: ['[data-test-subj="discoverQueryHits"]'],
      table: ['[data-test-subj="docTable"]'],
      textarea: ['textarea[data-test-subj="queryInput"]'],
      submitBtn: ['[data-test-subj="querySubmitButton"]'],
      tracesBtn: ['[data-test-subj="field-message.traceid-showDetails"]'],
      popover: ['.dscSidebarItem__fieldPopoverPanel'],
      popoverTraceItems: ['[data-test-subj="fieldVisualizeBucketContainer"] .euiText[title]'],
    },
  };

  const TEXTS = {
    notFoundScrollable: 'Скролл не найден',
    notFoundTable: 'Таблица не найдена',
    notFoundTraces: 'Трейсы не найдены',
    selectedInserted: 'Трейс выделен, подставлен только он',
    tracesInserted: 'Трейс не выделен, подставлены все',
    scrollStopped: (n) => `Скролл остановлен, подставлены первые ${n} трейсов`,
    limitHit: (n) => `Скролл завершен, подставлены первые ${n} трейсов`,
    genericOops: 'Что-то пошло не так',
  };

  // ---------- Notifications ----------
  const createNotifier = (key) => {
    if (window[key]) return window[key];
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: String(CFG.UI.Z),
      display: 'flex', flexDirection: 'column', gap: '8px',
    });
    document.body.appendChild(box);
    return (window[key] = { box, current: null, timer: null });
  };
  const notif = createNotifier('__notif_autotrace');
  const notify = (text, type = 'info', ms = CFG.UI.DURATION) => {
    if (notif.timer) { clearTimeout(notif.timer); notif.timer = null; }
    if (notif.current) { notif.current.remove(); notif.current = null; }
    const d = document.createElement('div');
    d.setAttribute('role', 'status');
    d.setAttribute('aria-live', 'polite');
    d.textContent = text;
    Object.assign(d.style, {
      padding: '10px 14px', borderRadius: '8px',
      background: CFG.UI.COLORS[type] || CFG.UI.COLORS.info, color: 'white',
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', minWidth: '160px',
      textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', userSelect: 'none', cursor: 'pointer',
    });
    d.addEventListener('click', () => { if (notif.timer) clearTimeout(notif.timer); d.remove(); notif.current = null; notif.timer = null; });
    notif.box.appendChild(d); notif.current = d;
    notif.timer = setTimeout(() => { if (notif.current === d) { d.remove(); notif.current = null; } notif.timer = null; }, Math.max(300, ms | 0));
  };
  const ok = (m) => notify(m, 'success');
  const err = (m) => notify(m, 'error');

  // ---------- Utils ----------
  const qs = (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } };
  const pickOne = (cands, root = document) => { for (const s of (cands || [])) { const el = qs(s, root); if (el) return el; } return null; };
  const parseIntSafe = (t) => { if (!t) return 0; const n = parseInt(String(t).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : 0; };
  const sleep = (ms) => new Promise((r) => { const t = setTimeout(() => { state.timers.delete(t); r(); }, ms); state.timers.add(t); });
  const clearAllTimers = () => { for (const t of state.timers) clearTimeout(t); state.timers.clear(); };
  const scrollTop0 = () => { const s = pickOne(CFG.SELECTORS.scrollable); if (s) s.scrollTop = 0; state.didScrollDown = false; };
  const isEditable = (el) => {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const t = (el.type || '').toLowerCase();
      return t === 'text' || t === 'search';
    }
    return false;
  };
  const defocus = (el) => {
    const doBlur = () => {
      try { el?.blur?.(); } catch {}
      try { document.body?.focus?.(); } catch {}
    };
    doBlur();
    try { requestAnimationFrame(() => doBlur()); } catch {}
    setTimeout(doBlur, 0);
    setTimeout(doBlur, 60);
    setTimeout(doBlur, 300);
  };
  const clickEl = (el) => {
    if (!el) return false;
    try {
      el.focus?.();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.click?.();
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } catch {
      try { el.click?.(); } catch { return false; }
    }
    defocus(el);
    return true;
  };

  // ---------- Progress chip ----------
  const showProgress = () => {
    if (state.progress) state.progress.remove?.();
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', bottom: '20px', right: '20px', padding: '6px 10px',
      borderRadius: '8px', background: CFG.UI.COLORS.info, color: 'white',
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', zIndex: String(CFG.UI.Z),
      display: 'flex', alignItems: 'center', gap: '8px',
    });
    const textEl = document.createElement('div'); textEl.textContent = '0 трейсов';
    const btn = document.createElement('button'); btn.textContent = '×';
    Object.assign(btn.style, { fontSize: '12px', cursor: 'pointer', border: 'none', borderRadius: '4px', padding: '0 6px', background: 'white', color: CFG.UI.COLORS.info });
    box.appendChild(textEl); box.appendChild(btn); document.body.appendChild(box);
    const api = {
      update(v) { textEl.textContent = `${Math.min(v, CFG.LIMIT)} трейсов`; },
      remove() { box.remove(); state.progress = null; },
      onStop(h) { btn.addEventListener('click', h, { once: true }); },
    };
    state.progress = api; return api;
  };

  // ---------- Query input ----------
  const getQueryInputEl = () =>
    (CFG.SELECTORS.textarea.map((s) => qs(s)).filter(Boolean).filter((el) => isEditable(el) && el.offsetParent !== null)[0] || null);

  const pressEnter = (el) => {
    if (!el) return;
    const common = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', common));
    el.dispatchEvent(new KeyboardEvent('keypress', common));
    el.dispatchEvent(new KeyboardEvent('keyup', common));
  };

  const setNativeValue = (el, val) => {
    const desc =
      Object.getOwnPropertyDescriptor(el.constructor?.prototype || {}, 'value') ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') ||
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc?.set) desc.set.call(el, val); else el.value = val;
  };

  const clearEditable = (el) => { if (!el) return; if ('value' in el) { try { setNativeValue(el, ''); } catch { el.value = ''; } } };
  const trySetValue = (el, value) => {
    try {
      el.click?.(); el.focus?.();
      setNativeValue(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return ('value' in el ? String(el.value) === String(value) : false);
    } catch { return false; }
  };

  // ---------- Trace extraction helpers ----------
  const RE_HEX_LONG = /\b[0-9a-f]{16,64}\b/i;
  const RE_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

  const extractTraceFromText = (text) => {
    if (!text) return null;
    const t = String(text).trim();
    const m1 = t.match(RE_HEX_LONG);
    if (m1) return m1[0];
    const m2 = t.match(RE_UUID);
    if (m2) return m2[0];
    return null;
  };

  const getSelectedTraceStrict = () => {
    try {
      const sel = window.getSelection?.();
      if (!sel || sel.isCollapsed) return null;
      const raw = sel.toString().slice(0, 512);
      const trace = extractTraceFromText(raw);
      return trace || null;
    } catch { return null; }
  };

  // ---------- Table & extraction ----------
  const getTraceColumnIndex = (tableEl) => {
    const headerCells = Array.from(tableEl?.tHead?.rows?.[0]?.cells || []);
    const names = headerCells.map((th) => (th.innerText || th.textContent || '').trim().toLowerCase());
    let idx = names.findIndex((n) => n.includes('message.traceid'));
    if (idx === -1) idx = names.findIndex((n) => n.includes('traceid'));
    if (idx === -1) idx = names.findIndex((n) => n.includes('trace id'));
    return idx;
  };

  const getTracesFromTable = (tableEl, traceIdx, limit = Infinity) => {
    if (!tableEl || traceIdx == null || traceIdx < 0) return [];
    const seen = new Set();
    const traces = [];
    const rows = tableEl.querySelectorAll('tbody tr');
    for (const row of rows) {
      const cell = row.children[traceIdx];
      const valRaw = (cell?.innerText || cell?.textContent || '').trim();
      const val = extractTraceFromText(valRaw) || valRaw;
      if (val && val !== '-' && !seen.has(val)) {
        seen.add(val); traces.push(val);
        if (traces.length >= limit) break;
      }
    }
    return traces;
  };

  const getTracesFromPopover = () => {
    const pop = pickOne(CFG.SELECTORS.popover);
    if (!pop) return [];
    const seen = new Set();
    for (const sel of CFG.SELECTORS.popoverTraceItems) {
      const nodes = Array.from(pop.querySelectorAll(sel)).filter((el) => el && el.offsetParent !== null);
      for (const el of nodes) {
        const v = extractTraceFromText(el.getAttribute?.('title') || el.innerText || el.textContent || '');
        if (v && !seen.has(v)) seen.add(v);
      }
      if (seen.size) return Array.from(seen);
    }
    return [];
  };

  // ---------- Insert & run ----------
  const insertAndRun = async (traces, { notifyLimitIfCut = false, msgOverride = null } = {}) => {
    const uniq = Array.from(new Set(Array.isArray(traces) ? traces : []));
    if (uniq.length === 0) { err(TEXTS.notFoundTraces); return; }
    let payload = uniq;
    if (uniq.length > CFG.LIMIT) payload = uniq.slice(0, CFG.LIMIT);
    const value = '(' + payload.map((t) => JSON.stringify(t)).join(' ') + ')';
    const input = getQueryInputEl();
    if (input) {
      const current = 'value' in input ? String(input.value) : '';
      if (current !== value) {
        clearEditable(input);
        trySetValue(input, value);
      }
      await sleep(40);

      const submitBtn = pickOne(CFG.SELECTORS.submitBtn);
      if (!clickEl(submitBtn)) {
        pressEnter(input);
      } else {
        setTimeout(() => defocus(submitBtn), 80);
      }

      input.blur?.();
      document.body.focus?.();
    }

    if (state._suppressNextNotify) {
      state._suppressNextNotify = false;
    } else if (msgOverride) {
      ok(msgOverride);
    } else if (notifyLimitIfCut && uniq.length >= CFG.LIMIT) {
      ok(TEXTS.limitHit(CFG.LIMIT));
    } else {
      ok(TEXTS.tracesInserted);
    }

    if (state.didScrollDown) scrollTop0();
  };

  // ---------- Collect with scroll ----------
  const collectWithScroll = async (tableEl, traceIdx) => {
    const scrollable = pickOne(CFG.SELECTORS.scrollable);
    if (!scrollable) { err(TEXTS.notFoundScrollable); return []; }

    const prog = showProgress();
    state.stop = false;
    prog.onStop(() => {
      state.stop = true;
      const traces = getTracesFromTable(tableEl, traceIdx);
      ok(TEXTS.scrollStopped(traces.length));
      state._suppressNextNotify = true;
      prog.remove();
    });

    let last = -1, stable = 0;
    for (let i = 0; i < 600; i++) {
      if (state.stop) return getTracesFromTable(tableEl, traceIdx);

      scrollable.scrollTop = scrollable.scrollHeight;
      state.didScrollDown = true;

      const traces = getTracesFromTable(tableEl, traceIdx);
      prog.update(traces.length);
      if (traces.length >= CFG.LIMIT) { prog.remove(); return traces; }

      const rc = tableEl ? tableEl.querySelectorAll('tbody tr').length : 0;
      if (rc !== last) { last = rc; stable = 0; } else { stable++; }
      if (stable >= 10) { prog.remove(); return traces; }

      await sleep(100);
    }
    prog.remove();
    return getTracesFromTable(tableEl, traceIdx);
  };

  // ---------- Main ----------
  try {
    const selectedTrace = getSelectedTraceStrict();
    if (selectedTrace) {
      await insertAndRun([selectedTrace], { msgOverride: TEXTS.selectedInserted });
      try { const sel = window.getSelection?.(); sel?.removeAllRanges?.(); } catch {}
      return;
    }

    const scrollable = pickOne(CFG.SELECTORS.scrollable);
    if (!scrollable) { err(TEXTS.notFoundScrollable); return; }

    const countEl = pickOne(CFG.SELECTORS.count);
    const totalCount = parseIntSafe(countEl?.textContent);

    const tableHolder = pickOne(CFG.SELECTORS.table);
    const tableEl = (() => {
      if (!tableHolder) return null;
      if (tableHolder.tagName && tableHolder.tagName.toLowerCase() === 'table') return tableHolder;
      const tbl = tableHolder.querySelector('table');
      return tbl || tableHolder;
    })();
    if (!tableEl) { err(TEXTS.notFoundTable); return; }

    const traceIdx = getTraceColumnIndex(tableEl);
    if (traceIdx === -1) { err(TEXTS.notFoundTraces); return; }

    if (totalCount && totalCount <= 50) {
      const traces = getTracesFromTable(tableEl, traceIdx);
      await insertAndRun(traces, { notifyLimitIfCut: true });
      return;
    }

    const tracesBtn = pickOne(CFG.SELECTORS.tracesBtn);
    if (tracesBtn) {
      tracesBtn.click();
      await sleep(300);
      const fromPop = getTracesFromPopover();
      tracesBtn.click();

      if (fromPop.length > 0 && fromPop.length <= 4) { await insertAndRun(fromPop); return; }

      const traces = await collectWithScroll(tableEl, traceIdx);
      await insertAndRun(traces, { notifyLimitIfCut: true });
      return;
    }

    const traces = await collectWithScroll(tableEl, traceIdx);
    await insertAndRun(traces, { notifyLimitIfCut: true });
  } catch (e) {
    console.error('[Auto-trace v2] error:', e);
    err(TEXTS.genericOops);
  } finally {
    clearAllTimers();
  }
})();
