(async () => {
  // =========================
  // Share Short URL Helper — аккуратная версия в стиле v2/v3
  // с мягкой чисткой savedSearch (без перезагрузки)
  // =========================

  // ---------- Namespace/State ----------
  const NS = '__shareShortHelperV1';
  const state = (window[NS] ||= { timers: new Set(), running: false });

  // ---------- Конфиг ----------
  const CFG = {
    TIMEOUT: 7000,
    POLL: 60,
    UI: {
      Z: 999999,
      COLORS: { success: '#52c41a', error: '#ff4d4f', warn: '#faad14', info: '#3498db' },
      DURATION: 2000,
    },
    FEATURES: {
      TRY_ENABLE_SHORT: true,   // пробовать включать Short URL
      TRY_COPY_DIRECT: true,    // попытка скопировать URL прямо из поля
      CLOSE_BEHAVIOR: 'escape', // 'none' | 'escape' | 'toggle'
    },
  };

  const TEXTS = {
    share_not_found: 'Кнопка Share не найдена',
    panel_not_ready: 'Не удалось найти элементы панели Share',
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
    if (window.__notifShareV1) return window.__notifShareV1;
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', bottom: '20px', right: '20px',
      zIndex: String(CFG.UI.Z), display: 'flex',
      flexDirection: 'column', gap: '8px'
    });
    document.body.appendChild(box);
    window.__notifShareV1 = { box, current: null, timer: null };
    return window.__notifShareV1;
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
      padding: '10px 15px',
      borderRadius: '8px',
      background: CFG.UI.COLORS[type] || CFG.UI.COLORS.info,
      color: 'white',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      minWidth: '160px',
      textAlign: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      userSelect: 'none',
      cursor: 'pointer',
    });
    d.addEventListener('click', () => { if (n.timer) clearTimeout(n.timer); d.remove(); n.current = null; n.timer = null; });
    n.box.appendChild(d); n.current = d;
    n.timer = setTimeout(() => { if (n.current === d) { d.remove(); n.current = null; } n.timer = null; }, Math.max(300, ms | 0));
  }
  const ok = (m) => notify(m, 'success');
  const err = (m) => notify(m, 'error');
  const warn = (m) => notify(m, 'warn');
  const info = (m) => notify(m, 'info');

  // ---------- Утилиты ----------
  const sleep = (ms) => new Promise(r => { const t = setTimeout(r, ms); state.timers.add(t); });
  function clearAllTimers() { for (const t of state.timers) clearTimeout(t); state.timers.clear(); }
  function qs(sel) { try { return document.querySelector(sel); } catch { return null; } }
  function qsa(sel) { try { return Array.from(document.querySelectorAll(sel)); } catch { return []; } }
  function isVisible(el) { return !!(el && el.offsetParent !== null); }
  function clickSafe(el) {
    if (!el) return;
    try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })); }
    catch { el.click?.(); }
  }

  // ---------- Селекторы под вашу разметку ----------
  function findShareButton() {
    // <span class="euiButtonEmpty__text">Share</span> → ближайшая кликабельная оболочка
    const spans = qsa('span.euiButtonEmpty__text');
    for (const s of spans) {
      const t = (s.textContent || '').trim();
      if (t === 'Share') {
        const btn = s.closest('button, [role="button"], a') || s;
        if (isVisible(btn)) return btn;
      }
    }
    return null;
  }
  function findCopyLinkNode() {
    // <div class="euiText euiText--small">Copy link</div>
    const nodes = qsa('div.euiText.euiText--small');
    for (const n of nodes) {
      const t = (n.textContent || '').trim();
      if (t === 'Copy link') {
        const clickable = n.closest('button, [role="button"], a, [onclick]') || n;
        if (isVisible(clickable)) return clickable;
      }
    }
    return null;
  }

  // ---------- Чистка savedSearch БЕЗ перезагрузки ----------
  (function cleanSavedSearchInPlace() {
    try {
      const url = window.location.href;
      const cleanUrl = url.replace(/,savedSearch:'[^']*'/, ''); // как в исходном скрипте (без флага g)
      if (cleanUrl !== url) {
        history.replaceState(null, '', cleanUrl);
        info(TEXTS.url_cleaned);
      }
    } catch {}
  })();

  if (state.running) return;
  state.running = true;

  // ---------- Основной поток ----------
  try {
    const shareBtn = findShareButton();
    if (!shareBtn) { err(TEXTS.share_not_found); return; }

    clickSafe(shareBtn);

    const waitForPanelHints = async (timeoutMs = CFG.TIMEOUT) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const shortBtn = qs('button[data-test-subj="useShortUrl"]');
        const copyNode = findCopyLinkNode();
        if ((shortBtn && isVisible(shortBtn)) || copyNode) return { shortBtn, copyNode };
        await sleep(CFG.POLL);
      }
      return { shortBtn: null, copyNode: null };
    };

    const { shortBtn, copyNode } = await waitForPanelHints();
    if (!shortBtn && !copyNode) { err(TEXTS.panel_not_ready); return; }

    async function enableShortIfPossible(btn) {
      if (!CFG.FEATURES.TRY_ENABLE_SHORT) return true;
      if (!btn || !isVisible(btn)) { warn(TEXTS.short_not_found); return false; }
      if (btn.getAttribute('aria-checked') === 'true') return true;
      clickSafe(btn);
      const t0 = Date.now();
      while (btn.getAttribute('aria-checked') !== 'true') {
        if (Date.now() - t0 > CFG.TIMEOUT) { warn(TEXTS.short_wait_fail); return false; }
        await sleep(CFG.POLL);
      }
      return true;
    }
    await enableShortIfPossible(shortBtn);

    function getUrlFromPanel() {
      const inp = qs('input[value^="http"]') || qs('textarea[value^="http"]');
      if (!inp || !isVisible(inp)) return '';
      const v = (inp.value ?? inp.getAttribute?.('value') ?? inp.textContent ?? '').toString().trim();
      return v.startsWith('http') ? v : '';
    }
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
      const direct = getUrlFromPanel();
      if (direct) {
        copied = await copyToClipboard(direct);
        if (copied) ok(TEXTS.copied_direct);
      }
    }
    if (!copied) {
      const node = findCopyLinkNode();
      if (!node) { err(TEXTS.copy_not_found); return; }
      clickSafe(node);
      ok(TEXTS.copied_button);
    }

    if (CFG.FEATURES.CLOSE_BEHAVIOR === 'escape') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    } else if (CFG.FEATURES.CLOSE_BEHAVIOR === 'toggle') {
      clickSafe(shareBtn);
    }

    ok(TEXTS.done);
  } catch (e) {
    console.error('[Share Short URL Helper] error:', e);
    err(TEXTS.oops);
  } finally {
    clearAllTimers();
    state.running = false;
  }
})();
