(async () => {
  // =========================================================
  // Pretty-logs v2  •  unified style
  // =========================================================

  const NS = 'Pretty-logs v2';
  const state = (window[NS] ||= { timers: new Set() });

  const CFG = {
    LIMIT: {
      MAX_ROWS: 500,
      MAX_FIELD_CHARS: 50_000,
      MAX_JSON_SCAN: 80_000,
      MAX_TOTAL_OUT: 500_000,
    },
    OUTPUT: {
      HARD_INDENT: true,
      COL_SEP: '  ',
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

  // ---------- Notifications (unified) ----------
  const createNotifier = (key) => {
    if (window[key]) return window[key];
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'fixed', bottom: '20px', right: '20px', zIndex: String(CFG.UI.Z), display: 'flex', flexDirection: 'column', gap: '8px' });
    document.body.appendChild(box);
    return (window[key] = { box, current: null, timer: null });
  };
  const notif = createNotifier('__notif_prettylogs');
  const notify = (text, type = 'info', ms = CFG.UI.DURATION) => {
    if (notif.timer) { clearTimeout(notif.timer); notif.timer = null; }
    if (notif.current) { notif.current.remove(); notif.current = null; }
    const d = document.createElement('div');
    d.setAttribute('role', 'status');
    d.setAttribute('aria-live', 'polite');
    d.textContent = text;
    Object.assign(d.style, {
      padding: '10px 15px', borderRadius: '8px', background: CFG.UI.COLORS[type] || CFG.UI.COLORS.info,
      color: 'white', fontFamily: 'system-ui, sans-serif', fontSize: '14px', minWidth: '160px', textAlign: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    });
    d.addEventListener('click', () => { if (notif.timer) clearTimeout(notif.timer); d.remove(); notif.current = null; notif.timer = null; });
    notif.box.appendChild(d); notif.current = d;
    notif.timer = setTimeout(() => { if (notif.current === d) { d.remove(); notif.current = null; } notif.timer = null; }, Math.max(300, ms | 0));
  };
  const ok = (m) => notify(m, 'success');
  const err = (m) => notify(m, 'error');

  // ---------- Utils ----------
  const sleep = (ms) => new Promise((r) => { const t = setTimeout(r, ms); state.timers.add(t); });
  const clearAllTimers = () => { for (const t of state.timers) clearTimeout(t); state.timers.clear(); };
  const norm = (s) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const isEmptyToken = (v) => {
    const t = (v ?? '').toString().trim().toLowerCase();
    return !t || t === '-' || t === '—' || t === '–' || t === 'n/a' || t === 'null' || t === 'undefined' || t === 'none';
  };
  const protectLeadingSpaces = (s) => (CFG.OUTPUT.HARD_INDENT ? s.replace(/^ +/gm, (m) => ' '.repeat(m.length)) : s);

  // ---------- Columns ----------
  const WANTED = ['Time', 'message.message', 'message.exception', 'Payload'];
  const WANTED_NORM = WANTED.map(norm);

  // ---------- JSON/XML prettify ----------
  const tryJSON = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const prettyWholeJson = (text) => {
    if (!text) return null;
    if (text.length > CFG.LIMIT.MAX_FIELD_CHARS) return null;
    const trimmed = text.trim();
    if (!/^[\[{]/.test(trimmed)) return null;
    const obj = tryJSON(trimmed);
    return obj != null ? JSON.stringify(obj, null, 2) : null;
  };
  const prettyJsonFragments = (text) => {
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
        else {
          if (c === '"') inStr = true;
          else if (c === open) depth++;
          else if (c === close) { depth--; if (depth === 0) break; }
        }
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
  };
  const parseXmlSafe = (xmlStr) => {
    try {
      const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
      if (doc.getElementsByTagName('parsererror')[0]) return null;
      return new XMLSerializer().serializeToString(doc);
    } catch { return null; }
  };
  const indentXml = (xmlStr) => {
    let s = xmlStr
      .replace(/>\s+</g, '><')
      .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
      .replace(/(\?>)(<)/g, '$1\n$2')
      .replace(/(--\>)(<)/g, '$1\n$2');
    const lines = s.split('\n').map((l) => l.trim()).filter(Boolean);
    let indent = 0; const out = [];
    for (const line of lines) {
      const isClose = /^<\/[^>]+>/.test(line);
      const isSelf = /\/>$/.test(line) || /^<[^>]+\/>$/.test(line);
      const isDecl = /^<\?xml/.test(line);
      const isCmnt = /^<!--/.test(line) && /-->$/.test(line);
      if (isClose) indent = Math.max(indent - 1, 0);
      out.push('  '.repeat(indent) + line);
      if (!isClose && !isSelf && !isDecl && !isCmnt && /^<[^!?][^>]*>$/.test(line)) indent++;
    }
    return out.join('\n');
  };
  const prettyXmlWhole = (text) => {
    if (!text) return null;
    if (text.length > CFG.LIMIT.MAX_FIELD_CHARS) return null;
    const normed = parseXmlSafe(text.trim());
    return normed ? indentXml(normed) : null;
  };
  const prettyXmlEmbedded = (text) => {
    if (!text) return null;
    const maxScan = CFG.LIMIT.MAX_FIELD_CHARS;
    if (text.length > maxScan) return null;
    const first = text.indexOf('<');
    const last = text.lastIndexOf('>');
    if (first === -1 || last <= first) return null;
    for (let end = last; end > first; end--) {
      const candidate = text.slice(first, end + 1);
      const normed = parseXmlSafe(candidate);
      if (normed) {
        const pretty = indentXml(normed);
        const before = text.slice(0, first).replace(/\s+$/, '');
        const after = text.slice(end + 1).replace(/^\s+/, '');
        return (before ? before + '\n' : '') + pretty + (after ? '\n' + after : '');
      }
      if (end - first < 32) break;
    }
    return null;
  };
  const prettyValue = (raw, colName) => {
    let v = (raw ?? '').toString();
    if (norm(colName) === 'message.exception') v = (v.split(/\r?\n/)[0] || '').trim();
    if (isEmptyToken(v)) return '';
    const wholeJ = prettyWholeJson(v); if (wholeJ !== null) return wholeJ.trim();
    const fragJ = prettyJsonFragments(v); if (fragJ !== null) return fragJ.trim();
    const wholeX = prettyXmlWhole(v); if (wholeX !== null) return wholeX.trim();
    const embX = prettyXmlEmbedded(v); if (embX !== null) return embX.trim();
    return v.trim();
  };

  // ---------- Selection & extraction ----------
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) { err(TEXTS.not_selected); return; }

    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

    let table = common?.closest?.('table') || null;
    if (!table) {
      const allRowsGlob = Array.from(document.querySelectorAll('tbody tr, tr'));
      const rowsInSel = allRowsGlob.filter((tr) => selection.containsNode(tr, true));
      if (rowsInSel.length) {
        const counts = new Map();
        rowsInSel.forEach((tr) => {
          const t = tr.closest('table');
          if (t) counts.set(t, (counts.get(t) || 0) + 1);
        });
        table = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      }
    }
    if (!table) { err(TEXTS.no_fields); return; }

    const buildIdxMapFromHeaders = (headers) => {
      const idxMap = new Map();
      const headersNorm = headers.map(norm);
      WANTED_NORM.forEach((wn, order) => {
        const idx = headersNorm.indexOf(wn);
        if (idx !== -1) idxMap.set(WANTED[order], idx);
      });
      return idxMap;
    };
    const getTableMap = (tableEl) => {
      const ths = tableEl.querySelectorAll('thead th, tr th');
      if (!ths.length) return null;
      const headers = Array.from(ths).map((th) => th.textContent || '');
      const idxMap = buildIdxMapFromHeaders(headers);
      return idxMap.size ? idxMap : null;
    };

    const extractFromRows = (rows, getCells, idxMap) => {
      const res = [];
      for (const row of rows.slice(0, CFG.LIMIT.MAX_ROWS)) {
        if (!selection.containsNode(row, true)) continue;
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
    };

    const idxMap = getTableMap(table);
    if (!idxMap) { err(TEXTS.no_fields); return; }

    const allRows = Array.from(table.querySelectorAll('tbody tr, tr'));
    const rows = extractFromRows(allRows, (tr) => Array.from(tr.querySelectorAll('td, th')), idxMap);
    if (!rows.length) { err(TEXTS.no_fields); return; }

    const lines = rows.map((r) => r.join(CFG.OUTPUT.COL_SEP).replace(/[ \t]+$/g, '')).filter((line) => line.trim() !== '');
    let out = protectLeadingSpaces(lines.join('\n'));
    if (out.length > CFG.LIMIT.MAX_TOTAL_OUT) out = out.slice(0, CFG.LIMIT.MAX_TOTAL_OUT) + '\n…';
    if (CFG.OUTPUT.WRAP_MARKDOWN) out = '```\n' + out + '\n```';

    const copy = async (text) => {
      try {
        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy'); document.body.removeChild(ta);
        return ok;
      } catch { return false; }
    };

    const copied = await copy(out);
    if (copied) ok(TEXTS.copy_ok); else { console.log(out); err(TEXTS.copy_fail); }
  } catch (e) {
    console.error('[Pretty-logs v2] error:', e);
    err(TEXTS.oops);
  } finally {
    clearAllTimers();
  }
})();
