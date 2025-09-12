(async () => {
  // =========================================================
  // Share-logs v2  •  unified style
  // =========================================================

  const NS = 'Share-logs v2';
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
    SELECTORS: {
      shareButton: ['[data-test-subj="shareTopNavButton"]'],
      shareDialog: ['[role="dialog"]', '[data-test-subj="sharePanel"]'],
      shortToggle: ['button[data-test-subj="useShortUrl"]'],
      copyButton: ['button[data-test-subj*="copy"]', '[data-test-subj*="copy"]'],
      urlField: ['input[value^="http"]', 'textarea[value^="http"]'],
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
    done: 'Ссылка скопирована',
    oops: 'Что-то пошло не так',
  };

  // ---------- Notifications (unified) ----------
  const createNotifier = (key) => {
    if (window[key]) return window[key];
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', bottom: '20px', right: '20px',
      zIndex: String(CFG.UI.Z), display: 'flex',
      flexDirection: 'column', gap: '8px',
    });
    document.body.appendChild(box);
    return (window[key] = { box, current: null, timer: null });
  };
  const notif = createNotifier('__notif_sharelogs');
  const notify = (text, type = 'info', ms = CFG.UI.DURATION) => {
    if (notif.timer) { clearTimeout(notif.timer); notif.timer = null; }
    if (notif.current) { notif.current.remove(); notif.current = null; }
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
    d.addEventListener('click', () => { if (notif.timer) clearTimeout(notif.timer); d.remove(); notif.current = null; notif.timer = null; });
    notif.box.appendChild(d); notif.current = d;
    notif.timer = setTimeout(() => { if (notif.current === d) { d.remove(); notif.current = null; } notif.timer = null; }, Math.max(300, ms | 0));
  };
  const ok = (m) => notify(m, 'success');
  const err = (m) => notify(m, 'error');
  const warn = (m) => notify(m, 'warn');

  // ---------- Utils (unified) ----------
  const sleep = (ms) => new Promise((r) => { const t = setTimeout(r, ms); state.timers.add(t); });
  const clearAllTimers = () => { for (const t of state.timers) clearTimeout(t); state.timers.clear(); };
  const qs = (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } };
  const qsa = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch { return []; } };
  const pickOne = (cands, root = document) => { for (const s of cands || []) { const el = qs(s, root); if (el) return el; } return null; };
  const isVisible = (el) => !!(el && el.offsetParent !== null);
  const clickSafe = (el) => { if (!el) return; try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })); } catch { el.click?.(); } };

  // ---------- Clean savedSearch in-place ----------
  (() => {
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
    // 1) Find Share
    const findShareButton = () => {
      const el = pickOne(CFG.SELECTORS.shareButton);
      return isVisible(el) ? el : null;
    };
    const shareBtn = findShareButton();
    if (!shareBtn) { err(TEXTS.share_not_found); return; }
    clickSafe(shareBtn);

    // 2) Wait for dialog
    const waitForShareDialog = async (timeoutMs = CFG.TIMEOUT) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const dlg = pickOne(CFG.SELECTORS.shareDialog);
        if (dlg && isVisible(dlg)) return dlg;
        await sleep(CFG.POLL);
      }
      return null;
    };
    const dialog = await waitForShareDialog();
    if (!dialog) { err(TEXTS.panel_not_ready); return; }

    const findShortToggle = (root) => {
      const btn = pickOne(CFG.SELECTORS.shortToggle, root);
      return btn && isVisible(btn) ? btn : null;
    };
    const findCopyButton = (root) => {
      const el = pickOne(CFG.SELECTORS.copyButton, root);
      return el && isVisible(el) ? el : null;
    };
    const getUrlFromPanel = (root) => {
      const inp = pickOne(CFG.SELECTORS.urlField, root);
      if (!inp || !isVisible(inp)) return '';
      const v = (inp.value ?? inp.getAttribute?.('value') ?? inp.textContent ?? '').toString().trim();
      return v.startsWith('http') ? v : '';
    };

    // 3) Enable Short (optional)
    const enableShortIfPossible = async (root) => {
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
    };
    await enableShortIfPossible(dialog);

    // 4) Copy URL
    const copyToClipboard = async (text) => {
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } }
      catch {}
      return false;
    };

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

    // 5) Close dialog
    if (CFG.FEATURES.CLOSE_BEHAVIOR === 'escape') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    } else if (CFG.FEATURES.CLOSE_BEHAVIOR === 'toggle') {
      clickSafe(shareBtn);
    }

    notify(TEXTS.done, 'success', 1200);
  } catch (e) {
    console.error('[Share-logs v2] error:', e);
    err(TEXTS.oops);
  } finally {
    clearAllTimers();
    state.running = false;
  }
})();
