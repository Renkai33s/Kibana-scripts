(async function () {
  // =========================
  // Помощник трейсов v2 — только CSS‑селекторы Kibana/EUI (без XPath)
  // =========================
  // Поведение поповера: если значений ≤ 4 — подставляем их; если > 4 — скроллим таблицу

  const NS = "__traceHelperV2";
  const state = (window[NS] ||= { timers: new Set(), progress: null, didScrollDown: false });

  const CFG = {
    LIMIT: 20,
    ui: { zIndex: 999999, colors: { success: "#52c41a", error: "#ff4d4f", warn: "#faad14", info: "#3498db" }, notifDuration: 2000 },
    texts: {
      notFoundScrollable: "Элемент для прокрутки не найден",
      notFoundTable: "Таблица не найдена",
      notFoundTraces: "Трейсы не найдены",
      notFoundBtn: "Кнопка для открытия трейсов не найдена",
      limitHit: (n) => `Достигнут лимит в ${n} трейсов`,
      tracesInserted: "Трейсы подставлены",
      genericOops: "Что-то пошло не так",
      cannotDetectCount: "Не удалось определить количество трейсов",
    },
    selectors: {
      scrollable: [ '.dscCanvas' ],
      count: [ '[data-test-subj="discoverQueryHits"]' ],
      table: [ '[data-test-subj="docTable"]' ],
      textarea: [ '[data-test-subj="queryInput"]' ],
      tracesBtn: [ '[data-test-subj="field-message.traceid-showDetails"]' ],
      popover: [ '.dscSidebarItem__fieldPopoverPanel' ],
      popoverTraceItems: [
        '[data-test-subj="fieldVisualizeBucketContainer"] .euiText[title]',
        '.euiText.euiText--extraSmall.eui-textTruncate'
      ],
    },
  };

  // ---------- Утилиты ----------
  function qs(sel) { try { return document.querySelector(sel); } catch { return null; } }
  function pickOne(cands) { for (const s of cands) { const el = qs(s); if (el) return el; } return null; }
  function parseIntSafe(t) { if (!t) return 0; const n = parseInt(String(t).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : 0; }
  function sleep(ms) { return new Promise(r => { const t = setTimeout(r, ms); state.timers.add(t); }); }
  function clearAllTimers() { for (const t of state.timers) clearTimeout(t); state.timers.clear(); }
  function scrollTop0() { const s = pickOne(CFG.selectors.scrollable); if (s) s.scrollTop = 0; state.didScrollDown = false; }

  // ---------- Уведомления ----------
  function ensureNotifContainer() {
    if (window.__notifContainerV2) return window.__notifContainerV2;
    const c = document.createElement('div'); c.id = 'notif-container-v2';
    Object.assign(c.style, { position: 'fixed', bottom: '20px', right: '20px', width: 'auto', zIndex: String(CFG.ui.zIndex), display: 'flex', flexDirection: 'column', gap: '8px' });
    document.body.appendChild(c); window.__notifContainerV2 = c; window.__currentNotifV2 = null; window.__notifTimeoutV2 = null; return c;
  }
  function notify(text, type = 'info', ms = CFG.ui.notifDuration) {
    const c = ensureNotifContainer();
    if (window.__notifTimeoutV2) { clearTimeout(window.__notifTimeoutV2); window.__notifTimeoutV2 = null; }
    if (window.__currentNotifV2) { window.__currentNotifV2.remove(); window.__currentNotifV2 = null; }
    const el = document.createElement('div'); el.setAttribute('role','status'); el.setAttribute('aria-live','polite'); el.textContent = text;
    Object.assign(el.style, { padding: '10px 14px', borderRadius: '8px', color: 'white', fontFamily: 'system-ui, sans-serif', fontSize: '14px', minWidth: '160px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', background: CFG.ui.colors[type] || CFG.ui.colors.info });
    c.appendChild(el); window.__currentNotifV2 = el;
    window.__notifTimeoutV2 = setTimeout(() => { if (window.__currentNotifV2 === el) { el.remove(); window.__currentNotifV2 = null; } window.__notifTimeoutV2 = null; }, Math.max(300, ms|0));
  }

  // ---------- Прогресс ----------
  function showProgress() {
    if (state.progress) state.progress.remove();
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'fixed', bottom: '20px', right: '20px', padding: '6px 10px', borderRadius: '8px', background: CFG.ui.colors.info, color: 'white', fontFamily: 'system-ui, sans-serif', fontSize: '14px', zIndex: String(CFG.ui.zIndex), display: 'flex', alignItems: 'center', gap: '8px' });
    const textEl = document.createElement('div'); textEl.textContent = '0 трейсов';
    const btn = document.createElement('button'); btn.textContent = '×'; Object.assign(btn.style, { fontSize: '12px', cursor: 'pointer', border: 'none', borderRadius: '4px', padding: '0 6px', background: 'white', color: CFG.ui.colors.info });
    box.appendChild(textEl); box.appendChild(btn); document.body.appendChild(box);
    const api = { update(v){ textEl.textContent = `${Math.min(v, CFG.LIMIT)} трейсов`; }, remove(){ box.remove(); state.progress = null; }, onStop(h){ btn.addEventListener('click', h, { once: true }); } };
    state.progress = api; return api;
  }

  // ---------- Помощники поля запроса ----------
  function isEditable(el){ if(!el) return false; const tag = el.tagName?.toLowerCase(); if(el.isContentEditable) return true; if(tag==='textarea') return true; if(tag==='input'){ const t=(el.type||'').toLowerCase(); return t==='text'||t==='search'; } return false; }
  function getQueryInputEl(){
    const root = pickOne(CFG.selectors.textarea);
    const c = [];
    if (root) {
      if (isEditable(root)) c.push(root);
      c.push(root.querySelector('textarea'), root.querySelector('input[type="search"]'), root.querySelector('input[type="text"]'), root.querySelector('[contenteditable="true"]'), root.querySelector('textarea.ace_text-input'), root.querySelector('.monaco-editor textarea.inputarea'));
    }
    c.push(qs('input[data-test-subj="queryInput"]'), qs('textarea[data-test-subj="queryInput"]'), qs('[data-test-subj="queryInput"] input[type="search"]'), qs('[data-test-subj="queryInput"] input[type="text"]'), qs('[data-test-subj="queryInput"] textarea'), qs('[data-test-subj="queryInput"] [contenteditable="true"]'));
    const filtered = c.filter(Boolean).filter(el => isEditable(el) && el.offsetParent !== null);
    return filtered[0] || null;
  }
  function pressEnter(el){ if(!el) return; const common={key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}; el.dispatchEvent(new KeyboardEvent('keydown',common)); el.dispatchEvent(new KeyboardEvent('keypress',common)); el.dispatchEvent(new KeyboardEvent('keyup',common)); }
  function setNativeValue(el,val){ const setter = Object.getOwnPropertyDescriptor(el,'value')?.set || Object.getOwnPropertyDescriptor(el.constructor?.prototype||{},'value')?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set; if(setter) setter.call(el,val); else el.value = val; }
  function clearEditable(el){ if(!el) return; if(el.isContentEditable){ el.textContent=''; } else if('value' in el){ try{ setNativeValue(el,''); } catch{ el.value=''; } } }

  function forceReactOnChange(el, value){
    try {
      const propsKey = Object.keys(el).find(k => k.startsWith('__reactProps$'));
      const props = propsKey ? el[propsKey] : null;
      if (props && typeof props.onChange === 'function') {
        setNativeValue(el, value);
        props.onChange({ target: { value }, currentTarget: { value } });
        return true;
      }
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
      const fiber = fiberKey ? el[fiberKey] : null;
      const mp = fiber?.memoizedProps;
      if (mp && typeof mp.onChange === 'function') {
        setNativeValue(el, value);
        mp.onChange({ target: { value }, currentTarget: { value } });
        return true;
      }
    } catch {}
    return false;
  }
  function trackerHack(el, value){ try { const tracker = el._valueTracker; if (tracker) tracker.setValue(el.value); const d = Object.getOwnPropertyDescriptor(el.constructor?.prototype || {}, 'value') || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value'); d?.set?.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; } catch { return false; } }
  function typeCharByChar(el, value){ try { el.focus(); el.setSelectionRange?.(0, el.value?.length||0); let cur=''; for (const ch of value) { cur += ch; setNativeValue(el, cur); el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' })); } el.dispatchEvent(new Event('change', { bubbles: true })); return true; } catch { return false; } }
  function trySetValue(el, value){ try { el.click?.(); el.focus(); if (forceReactOnChange(el, value)) return true; if (trackerHack(el, value)) return true; setNativeValue(el, value); el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value })); el.dispatchEvent(new Event('change', { bubbles: true })); if (("value" in el && String(el.value) === String(value)) || el.textContent === value) return true; if (typeCharByChar(el, value)) return true; } catch {} return false; }

  // ---------- Таблица и извлечение трейсов ----------
  function getTraceColumnIndex(tableEl){ const headerCells = Array.from(tableEl?.tHead?.rows?.[0]?.cells || []); const names = headerCells.map(th => (th.innerText || th.textContent || '').trim().toLowerCase()); let idx = names.findIndex(n => n.includes('message.traceid')); if (idx === -1) idx = names.findIndex(n => n.includes('traceid')); if (idx === -1) idx = names.findIndex(n => n.includes('trace id')); return idx; }
  function getTracesFromTable(tableEl, traceIdx, limit=Infinity){ if(!tableEl||traceIdx==null||traceIdx<0) return []; const seen=new Set(); const traces=[]; const rows = tableEl.querySelectorAll('tbody tr'); for(const row of rows){ const cell=row.children[traceIdx]; const val=(cell?.innerText||cell?.textContent||'').trim(); if(val && val!=='-' && !seen.has(val)){ seen.add(val); traces.push(val); if(traces.length>=limit) break; } } return traces; }
  function getTracesFromPopover(){ const pop = pickOne(CFG.selectors.popover); if(!pop) return []; const seen = new Set(); const out = []; for (const sel of CFG.selectors.popoverTraceItems) { const nodes = Array.from(pop.querySelectorAll(sel)).filter(el => el && el.offsetParent !== null); for (const el of nodes) { const v = (el.innerText || el.textContent || '').trim(); if (v && !seen.has(v)) { seen.add(v); out.push(v); } } if (out.length) return out; } return out; }

  // ---------- Вставка и запуск ----------
  async function insertAndRun(traces, { notifyLimitIfCut = false } = {}){
    const uniq = Array.from(new Set(Array.isArray(traces) ? traces : []));
    if (uniq.length === 0) { notify(CFG.texts.notFoundTraces, 'error'); return; }
    let payload = uniq, cut = false; if (uniq.length > CFG.LIMIT) { payload = uniq.slice(0, CFG.LIMIT); cut = true; }
    const value = '(' + payload.map(t => JSON.stringify(t)).join(' ') + ')';
    const input = getQueryInputEl();
    if (input) { clearEditable(input); const ok = trySetValue(input, value); await sleep(40); pressEnter(input); if (!ok) { typeCharByChar(input, value); } }
    if (cut && notifyLimitIfCut) notify(CFG.texts.limitHit(CFG.LIMIT), 'success'); else notify(CFG.texts.tracesInserted, 'success');
    if (state.didScrollDown) scrollTop0();
  }

  // ---------- Сбор со скроллом ----------
  async function collectWithScroll(tableEl, traceIdx){ const scrollable = pickOne(CFG.selectors.scrollable); if(!scrollable){ notify(CFG.texts.notFoundScrollable,'error'); return []; } const prog=showProgress(); let last=-1, stable=0; for(let i=0;i<600;i++){ scrollable.scrollTop = scrollable.scrollHeight; state.didScrollDown = true; const traces=getTracesFromTable(tableEl, traceIdx); prog.update(traces.length); if(traces.length>=CFG.LIMIT){ prog.remove(); return traces; } const rc = tableEl ? tableEl.querySelectorAll('tbody tr').length : 0; if(rc!==last){ last=rc; stable=0; } else { stable++; } if(stable>=10){ prog.remove(); return traces; } await sleep(100); } prog.remove(); return getTracesFromTable(tableEl, traceIdx); }

  // ---------- Основной сценарий ----------
  try {
    const scrollable = pickOne(CFG.selectors.scrollable); if(!scrollable){ notify(CFG.texts.notFoundScrollable, 'error'); return; }
    const countEl = pickOne(CFG.selectors.count); const totalCount = parseIntSafe(countEl?.textContent);
    const tableHolder = pickOne(CFG.selectors.table); const tableEl = (function(){ if(!tableHolder) return null; if(tableHolder.tagName && tableHolder.tagName.toLowerCase()==='table') return tableHolder; const tbl = tableHolder.querySelector('table'); return tbl || tableHolder; })();
    if(!tableEl){ notify(CFG.texts.notFoundTable,'error'); return; }
    const traceIdx = getTraceColumnIndex(tableEl); if(traceIdx===-1){ notify(CFG.texts.notFoundTraces,'error'); return; }

    if (totalCount && totalCount <= 50) { const traces = getTracesFromTable(tableEl, traceIdx); await insertAndRun(traces, { notifyLimitIfCut: true }); return; }

    const tracesBtn = pickOne(CFG.selectors.tracesBtn);
    if (tracesBtn) {
      tracesBtn.click();
      await sleep(300);
      const fromPop = getTracesFromPopover();
      tracesBtn.click();

      if (fromPop.length > 0 && fromPop.length <= 4) { await insertAndRun(fromPop); return; }
      if (fromPop.length > 4) { const traces = await collectWithScroll(tableEl, traceIdx); await insertAndRun(traces, { notifyLimitIfCut: true }); return; }

      const traces = await collectWithScroll(tableEl, traceIdx); await insertAndRun(traces, { notifyLimitIfCut: true }); return;
    }

    const traces = await collectWithScroll(tableEl, traceIdx); await insertAndRun(traces, { notifyLimitIfCut: true });
  } catch (e) { console.error('[Помощник трейсов v2] error:', e); notify(CFG.texts.genericOops, 'error'); }
  finally { clearAllTimers(); }
})();
