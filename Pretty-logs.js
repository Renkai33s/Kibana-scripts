(async () => {
  // =========================
  // Логовый форматтер v3.1 — фиксы под ваши замечания
  // =========================
  // Изменения:
  // 1) Тексты успехов/ошибок вынесены в один объект TEXTS.
  // 2) Фиксированный набор колонок и порядок: Time, message.message, message.exception, Payload.
  // 3) Починил парсинг SOAP/встроенного XML: ищем и красиво форматируем XML-фрагмент внутри текста
  //    (префикс, например "SOAP-OUT message:", переносится на отдельную строку перед XML).

  // ---------- Конфиг ----------
  const CFG = {
    LIMIT: {
      MAX_ROWS: 500,
      MAX_FIELD_CHARS: 50_000,
      MAX_JSON_SCAN: 80_000,
      MAX_TOTAL_OUT: 500_000,
    },
    OUTPUT: {
      HARD_INDENT: true,            // NBSP для ведущих пробелов
      COL_SEP: '\u00A0\u00A0',     // два NBSP между столбцами
      WRAP_MARKDOWN: false,
    },
    UI: {
      Z: 999999,
      COLORS: { success: '#52c41a', error: '#ff4d4f', warn: '#faad14', info: '#3498db' },
      DURATION: 2000,
    },
  };

  const TEXTS = {
    copy_ok: 'Логи скопированы',
    copy_fail: 'Не удалось скопировать',
    not_selected: 'Логи не выделены',
    no_fields: 'Нет подходящих полей',
    oops: 'Что-то пошло не так',
  };

  // ---------- Уведомления ----------
  function ensureNotif() {
    if (window.__notifV3) return window.__notifV3;
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'fixed', bottom: '20px', right: '20px', zIndex: String(CFG.UI.Z), display: 'flex', flexDirection: 'column', gap: '8px' });
    document.body.appendChild(box);
    window.__notifV3 = { box, current: null, timer: null };
    return window.__notifV3;
  }
  function notify(text, type = 'info', ms = CFG.UI.DURATION) {
    const n = ensureNotif();
    if (n.timer) { clearTimeout(n.timer); n.timer = null; }
    if (n.current) { n.current.remove(); n.current = null; }
    const d = document.createElement('div');
    d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite');
    d.textContent = text;
    Object.assign(d.style, {
      padding: '10px 15px', borderRadius: '8px', background: CFG.UI.COLORS[type] || CFG.UI.COLORS.info,
      color: 'white', fontFamily: 'system-ui, sans-serif', fontSize: '14px', minWidth: '160px', textAlign: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
    });
    n.box.appendChild(d); n.current = d;
    n.timer = setTimeout(() => { if (n.current === d) { d.remove(); n.current = null; } n.timer = null; }, Math.max(300, ms|0));
  }
  const ok = (m) => notify(m, 'success');
  const err = (m) => notify(m, 'error');

  // ---------- Утилиты текста ----------
  const NBSP = '\u00A0';
  const norm = (s) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const isEmptyToken = (v) => {
    const t = (v ?? '').toString().trim().toLowerCase();
    return !t || t === '-' || t === '—' || t === '–' || t === 'n/a' || t === 'null' || t === 'undefined' || t === 'none';
  };
  const protectLeadingSpaces = (s) => CFG.OUTPUT.HARD_INDENT ? s.replace(/^ +/gm, (m) => NBSP.repeat(m.length)) : s;

  // ---------- Фиксированные колонки ----------
  const WANTED = ['Time','message.message','message.exception','Payload'];
  const WANTED_NORM = WANTED.map(norm);

  // ---------- Prettify JSON/XML ----------
  const tryJSON = (s) => { try { return JSON.parse(s); } catch { return null; } };
  function prettyWholeJson(text) {
    if (!text) return null;
    if (text.length > CFG.LIMIT.MAX_FIELD_CHARS) return null;
    const trimmed = text.trim();
    if (!/^[\[{]/.test(trimmed)) return null;
    const obj = tryJSON(trimmed);
    return obj != null ? JSON.stringify(obj, null, 2) : null;
  }
  function prettyJsonFragments(text) {
    if (!text || text.length > CFG.LIMIT.MAX_JSON_SCAN) return null;
    let s = text, out = '', i = 0, changed = false;
    while (i < s.length) {
      const ch = s[i];
      if (ch !== '{' && ch !== '[') { out += ch; i++; continue; }
      const open = ch, close = open === '{' ? '}' : ']';
      let depth = 0, j = i, inStr = false, esc = false;
      for (; j < s.length; j++) {
        const c = s[j];
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
        else { if (c === '"') inStr = true; else if (c === open) depth++; else if (c === close) { depth--; if (depth === 0) break; } }
      }
      if (depth !== 0) { out += s[i++]; continue; }
      const candidate = s.slice(i, j + 1);
      const obj = tryJSON(candidate);
      if (obj != null) {
        const pretty = JSON.stringify(obj, null, 2);
        out = out.replace(/[ \t]+$/, '');
        out += '\n' + pretty;
        changed = true;
      } else {
        out += candidate;
      }
      i = j + 1;
    }
    return changed ? out : null;
  }
  function parseXmlSafe(xmlStr) {
    try {
      const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
      if (doc.getElementsByTagName('parsererror')[0]) return null;
      return new XMLSerializer().serializeToString(doc);
    } catch { return null; }
  }
  function indentXml(xmlStr) {
    let s = xmlStr
      .replace(/>\s+</g, '><')
      .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
      .replace(/(\?>)(<)/g, '$1\n$2')
      .replace(/(--\>)(<)/g, '$1\n$2');
    const lines = s.split('\n').map(l => l.trim()).filter(Boolean);
    let indent = 0; const out = [];
    for (const line of lines) {
      const isClose = /^<\/[^>]+>/.test(line);
      const isSelf  = /\/>$/.test(line) || /^<[^>]+\/>$/.test(line);
      const isDecl  = /^<\?xml/.test(line);
      const isCmnt  = /^<!--/.test(line) && /-->$/.test(line);
      if (isClose) indent = Math.max(indent - 1, 0);
      out.push('  '.repeat(indent) + line);
      if (!isClose && !isSelf && !isDecl && !isCmnt && /^<[^!?][^>]*>$/.test(line)) indent++;
    }
    return out.join('\n');
  }
  function prettyXmlWhole(text) {
    if (!text) return null;
    if (text.length > CFG.LIMIT.MAX_FIELD_CHARS) return null;
    const normed = parseXmlSafe(text.trim());
    return normed ? indentXml(normed) : null;
  }
  // Встроенный XML внутри строки: берём подстроку между первым '<' и последним '>' и пробуем парсить/красиво отформатировать.
  function prettyXmlEmbedded(text) {
    if (!text) return null;
    const maxScan = CFG.LIMIT.MAX_FIELD_CHARS;
    if (text.length > maxScan) return null; // защита от тяжёлых полей
    const first = text.indexOf('<');
    const last = text.lastIndexOf('>');
    if (first === -1 || last <= first) return null;
    for (let end = last; end > first; end--) {
      const candidate = text.slice(first, end + 1);
      const normed = parseXmlSafe(candidate);
      if (normed) {
        const pretty = indentXml(normed);
        const before = text.slice(0, first).replace(/\s+$/, '');
        const after  = text.slice(end + 1).replace(/^\s+/, '');
        return (before ? before + '\n' : '') + pretty + (after ? '\n' + after : '');
      }
      if (end - first < 32) break; // ранний выход
    }
    return null;
  }

  function prettyValue(raw, colName) {
    let v = (raw ?? '').toString();
    if (norm(colName) === 'message.exception') {
      v = (v.split(/\r?\n/)[0] || '').trim();
    }
    if (isEmptyToken(v)) return '';
    const wholeJ = prettyWholeJson(v); if (wholeJ !== null) return wholeJ.trim();
    const fragJ  = prettyJsonFragments(v); if (fragJ  !== null) return fragJ.trim();
    const wholeX = prettyXmlWhole(v);      if (wholeX !== null) return wholeX.trim();
    const embX   = prettyXmlEmbedded(v);   if (embX   !== null) return embX.trim();
    return v.trim();
  }

  // ---------- Поиск ближайшего контейнера ----------
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) { err(TEXTS.not_selected); return; }
  const range = selection.getRangeAt(0);
  const common = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
  const nearestTable = common?.closest?.('table') || common?.querySelector?.('table') || document.querySelector('table');
  const nearestGrid  = common?.closest?.('[role="grid"], [role="table"]') || common?.querySelector?.('[role="grid"], [role="table"]');

  // ---------- Построение индексов для фиксированных колонок ----------
  function buildIdxMapFromHeaders(headers) {
    const idxMap = new Map();
    const headersNorm = headers.map(norm);
    WANTED_NORM.forEach((wn, order) => {
      const idx = headersNorm.indexOf(wn);
      if (idx !== -1) idxMap.set(WANTED[order], idx);
    });
    return { idxMap, headers };
  }
  function buildIdxMapFromTable(tableEl) {
    const ths = tableEl.querySelectorAll('thead th, tr th');
    if (!ths.length) return null;
    const headers = Array.from(ths).map(th => th.textContent || '');
    return buildIdxMapFromHeaders(headers);
  }
  function buildIdxMapFromGrid(gridEl) {
    const headersEls = gridEl.querySelectorAll('[role="columnheader"]');
    if (!headersEls.length) return null;
    const headers = Array.from(headersEls).map(el => el.textContent || '');
    return buildIdxMapFromHeaders(headers);
  }

  // ---------- Извлечение строк ----------
  function extractFromRows(rows, getCells, idxMap) {
    const res = [];
    for (const row of rows.slice(0, CFG.LIMIT.MAX_ROWS)) {
      const cells = getCells(row);
      const vals = [];
      for (const wantedName of WANTED) {
        const colIdx = idxMap.get(wantedName);
        if (colIdx == null) continue;
        const raw = cells[colIdx]?.innerText ?? '';
        const val = prettyValue(String(raw).slice(0, CFG.LIMIT.MAX_FIELD_CHARS), wantedName);
        if (!isEmptyToken(val)) vals.push(val);
      }
      if (vals.length) res.push(vals);
    }
    return res;
  }

  // ---------- Основной поток ----------
  let rows = [];
  if (nearestTable) {
    const m = buildIdxMapFromTable(nearestTable);
    if (m?.idxMap?.size) {
      rows = extractFromRows(
        Array.from(nearestTable.querySelectorAll('tbody tr, tr')).filter(tr => selection.containsNode(tr, true)),
        (tr) => Array.from(tr.querySelectorAll('td, th')),
        m.idxMap
      );
    }
  }
  if (!rows.length && nearestGrid) {
    const m = buildIdxMapFromGrid(nearestGrid);
    if (m?.idxMap?.size) {
      rows = extractFromRows(
        Array.from(nearestGrid.querySelectorAll('[role="row"]')).filter(r => selection.containsNode(r, true)),
        (r) => Array.from(r.querySelectorAll('[role="gridcell"], [role="cell"]')),
        m.idxMap
      );
    }
  }
  if (!rows.length && nearestTable) {
    const anchorTr = selection.anchorNode?.parentElement?.closest?.('tr');
    if (anchorTr) {
      const m = buildIdxMapFromTable(nearestTable);
      if (m?.idxMap?.size) {
        rows = extractFromRows([anchorTr], (tr) => Array.from(tr.querySelectorAll('td, th')), m.idxMap);
      }
    }
  }

  if (!rows.length) { err(TEXTS.no_fields); return; }

  const lines = rows.map(r => r.join(CFG.OUTPUT.COL_SEP).replace(/[ \t]+$/g, '')).filter(line => line.trim() !== '');
  let out = protectLeadingSpaces(lines.join('\n'));
  if (out.length > CFG.LIMIT.MAX_TOTAL_OUT) out = out.slice(0, CFG.LIMIT.MAX_TOTAL_OUT) + '\n…';
  if (CFG.OUTPUT.WRAP_MARKDOWN) out = '```\n' + out + '\n```';

  // ---------- Копирование ----------
  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.focus(); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
    } catch { return false; }
  }

  const copied = await copy(out);
  if (copied) notify(TEXTS.copy_ok, 'success'); else { console.log(out); err(TEXTS.copy_fail); }
})();
