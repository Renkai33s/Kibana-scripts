(async () => {
  // =========================
  // Share Short URL Helper v2 — упрощённый и надёжный
  // =========================

  const NS = '__shareShortHelperV2';
  const state = (window[NS] ||= { timers: new Set(), running: false });

  const CFG = {
    TIMEOUT: 7000,
    POLL: 60,
    UI: {
      Z: 999999,
      COLORS: { success: '#52c41a', error: '#ff4d4f', warn: '#faad14', info: '#3498db' },
      DURATION: 2000,
    },
    FEATURES: {
      TRY_ENABLE_SHORT: true,   // включать Short URL, если доступно
      TRY_COPY_DIRECT: true,    // пытаться копировать прямо из поля URL
      CLOSE_BEHAVIOR: 'escape', // 'none' | 'escape' | 'toggle'
    },
  };

  const TEXTS = {
    share_not_found: 'Кнопка Share не найдена',
    panel_not_ready: 'Не удалось найти панель Share',
    short_not_found: 'Тумблер Short URL не найден (пропускаю)',
    short_wait_fail: 'Short URL не активировался вовремя',
    copied_direct: 'Короткая ссылка скопирована',
    copied_button: 'Ссылка скопирована (через кнопку)',
    copy_not_found: 'Кнопка "Copy link" не найдена',
    copy_fail: 'Не удалось скопировать',
    url_cleaned: 'URL очищен, продолжаем…',
    done: 'Готово',
    oops: 'Что-то пошло не так',
  };

  // ---------- Уведомления ----------
  function ensureNotif() {
    if (window.__notifShareV2) return window.__notifShareV2;
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', bottom: '20px', right: '20px',
      zIndex: String(CFG.UI.Z), display: 'flex',
      flexDirection: 'column', gap: '8px'
    });
    document.body.appendChild(box);
    window.__notifShareV2 = { box, current: null, timer: null };
    return window.__notifShareV2;
  }
  function notify(text, type = 'info', ms = CFG.UI.DURATION) {
    const n = ensureNotif();
    if (n.timer) { clearTimeout(n.timer); n.timer = null; }
    if (n.current) { n.current.remove(); n.current = null; }
    const d = document.createElement('div');
    d.setAttribute('role', 'status');
    d.setAttribute('aria-live', 'polite');
    d.textContent = text;
    Object.assign(d.style, {
      padding: '10px 15px', borderRadius: '8px',
      background: CFG.UI.COLORS[type] || CFG.UI.COLORS.info,
      color: 'white', fontFamily: 'system-ui, sans-serif',
      fontSize: '14px', minWidth: '160px', textAlign: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)', userSelect: 'none', cursor: 'pointer',
    });
    d.addEventListener('click', () => { if (n.timer) clearTimeout(n.timer); d.remove(); n.current = null; n.timer = null; });
    n.box.appendChild(d); n.current = d;
    n.timer = setTimeout(() => { if (n.current === d) { d.remove(); n.current = null; } n.timer = null; }, Math.max(300, ms | 0));
  }
  const ok = (m) => notify(m, 'success');
  const err = (m) => notify(m, 'error');
  const warn = (m) => notify(m, 'warn');

  // ---------- Утилиты ----------
  const sleep = (ms) => new Promise(r => { const t = setTimeout(r, ms); state.timers.add(t); });
  function clearAllTimers() { for (const t of state.timers) clearTimeout(t); state.timers.clear(); }
  const qs = (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } };
  const qsa = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch { return []; } };
  const isVisible = (el) => !!(el && el.offsetParent !== null);
  function clickSafe(el) {
    if (!el) return;
    try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })); }
    catch { el.click?.(); }
  }

  // ---------- Чистка savedSearch БЕЗ перезагрузки ----------
  (function cleanSavedSearchInPlace() {
    try {
      const url = window.location.href;
      const cleanUrl = url.replace(/,savedSearch:'[^']*'/, '');
      if (cleanUrl !== url) {
        history.replaceState(null, '', cleanUrl);
        notify(TEXTS.url_cleaned, 'info', 1200);
      }
    } catch {}
  })();

  if (state.running) return;
  state.running = true;

  try {
    // 1) Находим Share
    function findShareButton() {
      // приоритет — стабильный data-test-subj
      const bySubj = qs('[data-test-subj="shareTopNavButton"]');
      if (isVisible(bySubj)) return bySubj;
      // фолбэк по видимому тексту
      for (const b of qsa('button,[role="button"],a')) {
        const t = (b.textContent || '').trim();
        if (t === 'Share' && isVisible(b)) return b;
      }
      return null;
    }
    const shareBtn = findShareButton();
    if (!shareBtn) { err(TEXTS.share_not_found); return; }
    clickSafe(shareBtn);

    // 2) Ждём диалог Share и ключевые элементы внутри него
    async function waitForShareDialog(timeoutMs = CFG.TIMEOUT) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const dlg = qs('[role="dialog"]') || qs('[data-test-subj="sharePanel"]');
        if (dlg && isVisible(dlg)) return dlg;
        await sleep(CFG.POLL);
      }
      return null;
    }
    const dialog = await waitForShareDialog();
    if (!dialog) { err(TEXTS.panel_not_ready); return; }

    function findShortToggle(root) {
      const btn = qs('button[data-test-subj="useShortUrl"]', root);
      return (btn && isVisible(btn)) ? btn : null;
    }
    function findCopyButton(root) {
      // сначала — по data-test-subj (если присутствует в вашей версии)
      const bySubj = qs('button[data-test-subj*="copy"]', root) || qs('[data-test-subj*="copy"]', root);
      if (bySubj && isVisible(bySubj)) return bySubj;
      // затем — по видимому тексту
      const candidates = qsa('button,[role="button"],a', root);
      for (const n of candidates) {
        const t = (n.textContent || '').trim();
        if (t === 'Copy link' && isVisible(n)) return n;
      }
      return null;
    }
    function getUrlFromPanel(root) {
      const inp = qs('input[value^="http"], textarea[value^="http"]', root);
      if (!inp || !isVisible(inp)) return '';
      const v = (inp.value ?? inp.getAttribute?.('value') ?? inp.textContent ?? '').toString().trim();
      return v.startsWith('http') ? v : '';
    }

    // 3) Включаем Short URL (если опция включена)
    async function enableShortIfPossible(root) {
      if (!CFG.FEATURES.TRY_ENABLE_SHORT) return true;
      const btn = findShortToggle(root);
      if (!btn) { warn(TEXTS.short_not_found); return false; }
      if (btn.getAttribute('aria-checked') === 'true') return true;
      clickSafe(btn);
      const t0 = Date.now();
      while (btn.getAttribute('aria-checked') !== 'true') {
        if (Date.now() - t0 > CFG.TIMEOUT) { warn(TEXTS.short_wait_fail); return false; }
        await sleep(CFG.POLL);
      }
      return true;
    }
    await enableShortIfPossible(dialog);

    // 4) Копируем URL
    async function copyToClipboard(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
      } catch {}
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy'); document.body.removeChild(ta);
        return !!ok;
      } catch { return false; }
    }

    let copied = false;
    if (CFG.FEATURES.TRY_COPY_DIRECT) {
      const direct = getUrlFromPanel(dialog);
      if (direct) {
        copied = await copyToClipboard(direct);
        if (copied) notify(TEXTS.copied_direct, 'success', 1400);
      }
    }
    if (!copied) {
      const copyBtn = findCopyButton(dialog);
      if (!copyBtn) { err(TEXTS.copy_not_found); return; }
      clickSafe(copyBtn);
      notify(TEXTS.copied_button, 'success', 1400);
    }

    // 5) Закрываем диалог
    if (CFG.FEATURES.CLOSE_BEHAVIOR === 'escape') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    } else if (CFG.FEATURES.CLOSE_BEHAVIOR === 'toggle') {
      clickSafe(shareBtn);
    }

    notify(TEXTS.done, 'success', 1200);
  } catch (e) {
    console.error('[Share Short URL Helper v2] error:', e);
    err(TEXTS.oops);
  } finally {
    clearAllTimers();
    state.running = false;
  }
})();
