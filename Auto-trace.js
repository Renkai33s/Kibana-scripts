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

  // ---------- RU plural + single phrase ----------
  const ruPlural = (n, one, few, many) => {
    const abs = Math.abs(n), mod10 = abs % 10, mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  };
  const tracesWord = (n) => ruPlural(n, 'трейс', 'трейса', 'трейсов');
  const insertedVerb = (n) => ruPlural(n, 'подставлен', 'подставлены', 'подставлены');
  const insertedPhrase = (n) => `${insertedVerb(n)} ${n} ${tracesWord(n)}`; // <— единая «фраза после запятой»
  const countWord = (n) => `${n} ${tracesWord(n)}`;

  const TEXTS = {
    notFoundScrollable: 'Скролл не найден',
    notFoundTable: 'Таблица не найдена',
    notFoundTraces: 'Трейсы не найдены',
    selectedInserted:   (n) => `Трейс выделен, ${insertedPhrase(n)}`,
    tracesInserted:     (n) => `Трейс не выделен, ${insertedPhrase(n)}`,
    scrollStopped:      (n) => `Скролл остановлен, ${insertedPhrase(n)}`,
    limitHit:           (n) => `Достигнут лимит, ${insertedPhrase(n)}`,
    genericOops: 'Что-то пошло не так',
  };

  // ---------- Notifications ----------
  const createNotifier = (key) => {
    if (window[key]) return window[key];
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: String(CFG.UI.Z),
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      alignItems: 'flex-end',
      pointerEvents: 'none',
    });
    document.body.appendChild(box);

    const reduceMotion = (() => {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch { return false; }
    })();

    const transitionEnd = (el) =>
      new Promise((res) => {
        let done = false;
        const finish = () => { if (!done) { done = true; el.removeEventListener('transitionend', onEnd); res(); } };
        const onEnd = (e) => { if (e.target === el) finish(); };
        el.addEventListener('transitionend', onEnd);
        setTimeout(finish, 500);
      });

    const animIn = async (el) => {
      if (reduceMotion) { el.style.opacity = '1'; el.style.transform = 'none'; return; }
      el.style.willChange = 'opacity, transform';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px) scale(0.98)';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      el.style.transition = 'opacity 200ms ease, transform 200ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
      await transitionEnd(el);
      el.style.willChange = '';
      el.style.transition = '';
    };

    const animOut = async (el) => {
      if (!el.isConnected) return;
      if (reduceMotion) { el.remove(); return; }
      el.style.willChange = 'opacity, transform';
      el.style.transition = 'opacity 160ms ease, transform 160ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px) scale(0.98)';
      await transitionEnd(el);
      el.remove();
    };

    return (window[key] = {
      box,
      current: null,
      timer: null,
      reduceMotion,
      animIn,
      animOut,
    });
  };

  const notif = createNotifier('__notif_autotrace');

  const notify = async (text, type = 'info', ms = CFG.UI.DURATION) => {
    if (notif.timer) { clearTimeout(notif.timer); notif.timer = null; }
    if (notif.current) {
      const prev = notif.current;
      notif.current = null;
      await notif.animOut(prev);
    }

    const d = document.createElement('div');
    d.setAttribute('role', 'status');
    d.setAttribute('aria-live', 'polite');
    d.textContent = text;
    Object.assign(d.style, {
      pointerEvents: 'auto',
      padding: '10px 14px',
      borderRadius: '8px',
      background: CFG.UI.COLORS[type] || CFG.UI.COLORS.info,
      color: 'white',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      minWidth: '180px',
      textAlign: 'center',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      userSelect: 'none',
      cursor: 'pointer',
    });

    d.addEventListener('click', async () => {
      if (notif.timer) { clearTimeout(notif.timer); notif.timer = null; }
      if (notif.current === d) notif.current = null;
      await notif.animOut(d);
    });

    notif.box.appendChild(d);
    notif.current = d;
    await notif.animIn(d);

    const hideAfter = Math.max(300, ms | 0);
    notif.timer = setTimeout(async () => {
      if (notif.current === d) notif.current = null;
      await notif.animOut(d);
      notif.timer = null;
    }, hideAfter);
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
    const reduceMotion = (() => {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch { return false; }
    })();

    const transitionEnd = (el) =>
      new Promise((res) => {
        let done = false;
        const finish = () => { if (!done) { done = true; el.removeEventListener('transitionend', onEnd); res(); } };
        const onEnd = (e) => { if (e.target === el) finish(); };
        el.addEventListener('transitionend', onEnd);
        setTimeout(finish, 500);
      });

    const animIn = async (el) => {
      if (reduceMotion) { el.style.opacity = '1'; el.style.transform = 'none'; return; }
      el.style.willChange = 'opacity, transform';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px) scale(0.98)';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      el.style.transition = 'opacity 200ms ease, transform 200ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
      await transitionEnd(el);
      el.style.willChange = '';
      el.style.transition = '';
    };

    const animOut = async (el) => {
      if (!el.isConnected) return;
      if (reduceMotion) { el.remove(); return; }
      el.style.willChange = 'opacity, transform';
      el.style.transition = 'opacity 160ms ease, transform 160ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px) scale(0.98)';
      await transitionEnd(el);
      el.remove();
    };

    const chip = document.createElement('div');
    Object.assign(chip.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '6px 10px',
      borderRadius: '8px',
      background: CFG.UI.COLORS.info,
      color: 'white',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      zIndex: String(CFG.UI.Z),
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      transformOrigin: 'right bottom',
    });

    const textEl = document.createElement('div');
    textEl.textContent = countWord(0);

    const btn = document.createElement('button');
    btn.textContent = '×';
    Object.assign(btn.style, {
      fontSize: '12px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: '4px',
      padding: '0 6px',
      background: 'white',
      color: CFG.UI.COLORS.info,
      lineHeight: '20px',
    });

    chip.appendChild(textEl);
    chip.appendChild(btn);
    document.body.appendChild(chip);

    animIn(chip);

    let currentVal = 0;
    let rafId = null;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const setCountImmediate = (v) => {
      currentVal = v;
      textEl.textContent = countWord(v);
    };

    const tweenTo = (target, dur = 280) => {
      if (reduceMotion) { setCountImmediate(target); return; }
      const start = currentVal;
      const delta = target - start;
      if (delta === 0) return;

      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      const t0 = performance.now();

      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const val = Math.round(start + delta * easeOutCubic(t));
        textEl.textContent = countWord(val);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          currentVal = target;
          rafId = null;
        }
      };
      rafId = requestAnimationFrame(step);

      if (!reduceMotion) {
        chip.style.transition = 'transform 160ms ease';
        chip.style.transform = 'translateY(0) scale(1.03)';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            chip.style.transform = 'translateY(0) scale(1)';
          });
        });
      }
    };

    const api = {
      update(v) {
        const n = Math.min(v | 0, CFG.LIMIT);
        tweenTo(n);
      },
      remove() {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        animOut(chip);
        state.progress = null;
      },
      onStop(h) { btn.addEventListener('click', h, { once: true }); },
    };

    state.progress = api;
    return api;
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

    const count = payload.length;

    if (state._suppressNextNotify) {
      state._suppressNextNotify = false;
    } else if (msgOverride) {
      ok(typeof msgOverride === 'function' ? msgOverride(count) : msgOverride);
    } else if (notifyLimitIfCut && uniq.length >= CFG.LIMIT) {
      ok(TEXTS.limitHit(count));
    } else {
      ok(TEXTS.tracesInserted(count));
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

      const container = pickOne(CFG.SELECTORS.scrollable);
      container.scrollTop = container.scrollHeight;
      state.didScrollDown = true;

      const traces = getTracesFromTable(tableEl, traceIdx);
      prog.update(traces.length);
      if (traces.length >= CFG.LIMIT) { prog.remove(); return traces; }

      const rc = tableEl ? tableEl.querySelectorAll('tbody tr').length : 0;
      if (rc !== last) { last = rc; stable = 0; } else { stable++; }
      if (stable >= 10) { prog.remove(); return traces; }

      await sleep(100);
    }
    try { prog.remove(); } catch {}
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
