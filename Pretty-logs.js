(async () => {
  // =========================================================
  // Pretty-logs v2  •  unified style (no numeric value changes)
  // =========================================================

  const NS = 'Pretty-logs v2';
  const state = (window[NS] ||= {
    timers: new Set(),
    progress: null,
    didScrollDown: false,
    stop: false,
  });

  const JSON_INDENT = '  '; // отступ внутри JSON/XML
  const COLUMN_SEPARATOR = ', '; // разделитель между столбцами

  const CFG = {
    LIMIT: {
      MAX_ROWS: 500,
      MAX_FIELD_CHARS: 50_000,
      MAX_JSON_SCAN: 80_000,
      MAX_TOTAL_OUT: 500_000,
    },
    SCROLL_LIMIT_ROWS: 200,
    OUTPUT: {
      HARD_INDENT: true,
      COL_SEP: COLUMN_SEPARATOR,
      WRAP_MARKDOWN: false,
    },
    UI: {
      Z: 999999,
      COLORS: { success: '#52c41a', error: '#ff4d4f', warn: '#faad14', info: '#3498db' },
      DURATION: 2000,
    },
    SELECTORS: {
      scrollable: ['.dscCanvas'],
      count: ['[data-test-subj="discoverQueryHits"]'],
      table: ['[data-test-subj="docTable"]'],
    },
  };

  // ---------- Pluralization (ru) ----------
  const ruPlural = (n, one, few, many) => {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  };
  const rowsWord = (n) => `${n} ${ruPlural(n, 'строка', 'строки', 'строк')}`;
  const ruVerbCopied = (n) => ruPlural(n, 'скопирована', 'скопированы', 'скопировано');
  const copiedPhrase = (n) => `${ruVerbCopied(n)} ${rowsWord(n)}`;

  const TEXTS = {
    no_fields: 'Таблица не найдена',
    copy_fail: 'Не удалось скопировать',
    copy_ok: (n) => `Логи выделены, ${copiedPhrase(n)}`,
    not_selected_all: (n) => `Логи не выделены, ${copiedPhrase(n)}`,
    scroll_stopped_rows: (n) => `Скролл остановлен, ${copiedPhrase(n)}`,
    scroll_limit_rows: (n) => `Достигнут лимит, ${copiedPhrase(n)}`,
    oops: 'Что-то пошло не так',
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
    });
    document.body.appendChild(box);
    return (window[key] = { box, current: null, timer: null });
  };
  const notif = createNotifier('__notif_prettylogs');
  const notify = (text, type = 'info', ms = CFG.UI.DURATION) => {
    if (notif.timer) {
      clearTimeout(notif.timer);
      notif.timer = null;
    }
    if (notif.current) {
      notif.current.remove();
      notif.current = null;
    }
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
    d.addEventListener('click', () => {
      if (notif.timer) clearTimeout(notif.timer);
      d.remove();
      notif.current = null;
      notif.timer = null;
    });
    notif.box.appendChild(d);
    notif.current = d;
    notif.timer = setTimeout(() => {
      if (notif.current === d) {
        d.remove();
        notif.current = null;
      }
      notif.timer = null;
    }, Math.max(300, ms | 0));
  };
  const ok = (m) => notify(m, 'success');
  const err = (m) => notify(m, 'error');

  // ---------- Utils ----------
  const sleep = (ms) =>
    new Promise((r) => {
      const t = setTimeout(() => {
        state.timers.delete(t);
        r();
      }, ms);
      state.timers.add(t);
    });
  const clearAllTimers = () => {
    for (const t of state.timers) clearTimeout(t);
    state.timers.clear();
  };
  const norm = (s) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const parseIntSafe = (t) => {
    if (!t) return 0;
    const n = parseInt(String(t).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const isEmptyToken = (v) => {
    const t = (v ?? '').toString().trim().toLowerCase();
    return (
      !t ||
      t === '-' ||
      t === '—' ||
      t === '–' ||
      t === 'n/a' ||
      t === 'null' ||
      t === 'undefined' ||
      t === 'none'
    );
  };
  const protectLeadingSpaces = (s) => (CFG.OUTPUT.HARD_INDENT ? s : s);
  const qs = (sel, root = document) => {
    try {
      return root.querySelector(sel);
    } catch {
      return null;
    }
  };
  const pickOne = (cands, root = document) => {
    for (const s of cands || []) {
      const el = qs(s, root);
      if (el) return el;
    }
    return null;
  };
  const scrollTop0 = () => {
    const s = pickOne(CFG.SELECTORS.scrollable);
    if (s) s.scrollTop = 0;
    state.didScrollDown = false;
  };

  // ---------- Columns ----------
  const WANTED = ['Time', 'message.message', 'message.exception', 'Payload'];
  const WANTED_NORM = WANTED.map(norm);

  // ---------- Time rounding (to 3 decimals) ----------
  const roundTimeMs = (s) => {
    if (!s) return s;
    return s.replace(/(\d{2}:\d{2}:\d{2})(\.(\d+))?/, (match, hms, dotPart, frac) => {
      if (!frac) return match;
      if (frac.length <= 3) return hms + '.' + frac;

      const original = frac;
      const num = Number('0.' + frac);
      if (!Number.isFinite(num)) return match;

      let rounded = Math.round(num * 1000) / 1000;
      if (rounded >= 1) return hms + '.' + original.slice(0, 3);

      let fracStr = String(rounded).split('.')[1] || '';
      if (fracStr.length < 3) fracStr = (fracStr + '000').slice(0, 3);
      return hms + '.' + fracStr;
    });
  };

  // ---------- JSON helpers ----------
  const tryJSON = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  // ---------- Pretty JSON (без изменения чисел) ----------
  const formatJsonPreserveNumbers = (text) => {
    if (!text) return null;
    let s = text.trim();
    // 👉 не разворачиваем пустые JSON-объекты/массивы
    if (s === '{}' || s === '[]') return s;

    // Проверяем, что JSON валидный
    try {
      JSON.parse(s);
    } catch {
      return null;
    }

    let out = '';
    let indent = 0;
    let inStr = false;
    let esc = false;

    const pushIndent = () => {
      out += '\n' + JSON_INDENT.repeat(Math.max(indent, 0));
    };

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];

      if (inStr) {
        out += ch;
        if (esc) {
          esc = false;
        } else if (ch === '\\') {
          esc = true;
        } else if (ch === '"') {
          inStr = false;
        }
        continue;
      }

      if (ch === '"') {
        inStr = true;
        out += ch;
        continue;
      }

      // Вне строк – только структурное форматирование
      switch (ch) {
        case '{':
        case '[':
          out += ch;
          indent++;
          pushIndent();
          break;
        case '}':
        case ']':
          indent--;
          pushIndent();
          out += ch;
          break;
        case ',':
          out += ch;
          pushIndent();
          break;
        case ':':
          out += ': ';
          break;
        default:
          if (/\s/.test(ch)) {
            // игнорируем пробелы и переводы строк вне строк
          } else {
            // любые токены (включая числа) копируем как есть
            out += ch;
          }
      }
    }

    return out.trim();
  };

  const prettyWholeJson = (text) => {
    if (!text) return null;
    if (text.length > CFG.LIMIT.MAX_FIELD_CHARS) return null;
    const trimmed = text.trim();
    if (!/^[\[{]/.test(trimmed)) return null;
    if (tryJSON(trimmed) == null) return null;
    return formatJsonPreserveNumbers(trimmed);
  };

  const prettyJsonFragments = (text) => {
    if (!text || text.length > CFG.LIMIT.MAX_JSON_SCAN) return null;
    let s = text,
      out = '',
      i = 0,
      changed = false;
    while (i < s.length) {
      const ch = s[i];
      if (ch !== '{' && ch !== '[') {
        out += ch;
        i++;
        continue;
      }
      const open = ch,
        close = open === '{' ? '}' : ']';
      let depth = 0,
        j = i,
        inStr = false,
        esc = false;
      for (; j < s.length; j++) {
        const c = s[j];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
        } else {
          if (c === '"') inStr = true;
          else if (c === open) depth++;
          else if (c === close) {
            depth--;
            if (depth === 0) break;
          }
        }
      }
      if (depth !== 0) {
        out += s[i++];
        continue;
      }
      const candidate = s.slice(i, j + 1);
      const obj = tryJSON(candidate);
      if (obj != null) {
        const pretty = formatJsonPreserveNumbers(candidate);
        if (pretty != null) {
      
          // 👉 если JSON пустой — вставляем inline без переносов
          if (pretty === '{}' || pretty === '[]') {
            out += pretty;
          } else {
            out = out.replace(/\s+$/u, '');
            if (!out.endsWith('\n')) out += '\n';
            out += pretty;
          }
      
          changed = true;
        } else {
          out += candidate;
        }
      } else {
        out += candidate;
      }
      i = j + 1;
    }
    return changed ? out : null;
  };

  // ---------- XML helpers ----------
  const parseXmlSafe = (xmlStr) => {
    try {
      const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
      if (doc.getElementsByTagName('parsererror')[0]) return null;
      return new XMLSerializer().serializeToString(doc);
    } catch {
      return null;
    }
  };
  const indentXml = (xmlStr) => {
    let s = xmlStr
      .replace(/>\s+</g, '><')
      .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
      .replace(/(\?>)(<)/g, '$1\n$2')
      .replace(/(--\>)(<)/g, '$1\n$2');
    const lines = s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    let indent = 0;
    const out = [];
    for (const line of lines) {
      const isClose = /^<\/[^>]+>/.test(line);
      const isSelf = /\/>$/.test(line) || /^<[^>]+\/>$/.test(line);
      const isDecl = /^<\?xml/.test(line);
      const isCmnt = /^<!--/.test(line) && /-->$/.test(line);
      if (isClose) indent = Math.max(indent - 1, 0);
      out.push(JSON_INDENT.repeat(indent) + line);
      if (
        !isClose &&
        !isSelf &&
        !isDecl &&
        !isCmnt &&
        /^<[^!?][^>]*>$/.test(line)
      )
        indent++;
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

    // Округляем время до 3 знаков после запятой в колонке Time
    if (norm(colName) === 'time') {
      v = roundTimeMs(v);
    }

    if (norm(colName) === 'message.exception')
      v = (v.split(/\r?\n/)[0] || '').trim();
    if (isEmptyToken(v)) return '';
    const wholeJ = prettyWholeJson(v);
    if (wholeJ !== null) return wholeJ.trim();
    const fragJ = prettyJsonFragments(v);
    if (fragJ !== null) return fragJ.trim();
    const wholeX = prettyXmlWhole(v);
    if (wholeX !== null) return wholeX.trim();
    const embX = prettyXmlEmbedded(v);
    if (embX !== null) return embX.trim();
    return v.trim();
  };

  // ---------- Progress chip ----------
  const showProgress = () => {
    if (state.progress) state.progress.remove?.();
    const box = document.createElement('div');
    Object.assign(box.style, {
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
    });
    const textEl = document.createElement('div');
    textEl.textContent = rowsWord(0);
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
    });
    box.appendChild(textEl);
    box.appendChild(btn);
    document.body.appendChild(box);
    const api = {
      update(v) {
        textEl.textContent = rowsWord(v);
      },
      remove() {
        box.remove();
        state.progress = null;
      },
      onStop(h) {
        btn.addEventListener('click', h, { once: true });
      },
    };
    state.progress = api;
    return api;
  };

  // ---------- Table helpers ----------
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
  const getMainTable = () => {
    for (const s of CFG.SELECTORS.table) {
      const el = qs(s);
      if (el) {
        if (el.tagName && el.tagName.toLowerCase() === 'table') return el;
        const tbl = el.querySelector?.('table');
        return tbl || el;
      }
    }
    const any = Array.from(document.querySelectorAll('table')).find(
      (t) => t && t.offsetParent !== null,
    );
    return any || null;
  };

  const getAllRows = (table) => {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (rows.length) return rows;
    return Array.from(table.querySelectorAll('tr')).filter(
      (tr) => !tr.closest('thead'),
    );
  };

  const getCells = (tr) => Array.from(tr.querySelectorAll('td'));

  // ---------- Scroll collect ----------
  const collectWithScroll = async (tableEl, totalTarget = Infinity) => {
    const scrollable = pickOne(CFG.SELECTORS.scrollable);
    if (!scrollable) return { used: false, reason: 'no-scrollable' };

    const hardTarget = Math.min(
      totalTarget || Infinity,
      CFG.SCROLL_LIMIT_ROWS,
      CFG.LIMIT.MAX_ROWS,
    );

    const prog = showProgress();
    state.stop = false;
    let reason = 'target';
    prog.onStop(() => {
      state.stop = true;
      reason = 'manual';
      prog.remove();
    });

    let lastRowCount = -1,
      stable = 0;
    state.didScrollDown = true;

    for (let i = 0; i < 600; i++) {
      if (state.stop) break;

      scrollable.scrollTop = scrollable.scrollHeight;

      const rc = getAllRows(tableEl).length;
      prog.update(rc);

      if (rc >= hardTarget) {
        reason =
          hardTarget === CFG.SCROLL_LIMIT_ROWS ? 'scroll_limit' : 'target';
        prog.remove();
        break;
      }
      if (rc >= CFG.LIMIT.MAX_ROWS) {
        reason = 'max_rows';
        prog.remove();
        break;
      }

      if (rc !== lastRowCount) {
        lastRowCount = rc;
        stable = 0;
      } else {
        stable++;
      }
      if (stable >= 10) {
        reason = 'stable';
        prog.remove();
        break;
      }

      await sleep(100);
    }

    try {
      prog.remove();
    } catch {}
    scrollTop0();

    return { used: true, reason };
  };

  // ---------- Copy helper ----------
  const copy = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  // ---------- Main ----------
  try {
    const selection = window.getSelection?.();
    const hasSelection =
      !!(selection && selection.rangeCount && selection.toString().trim());

    let table = null;
    if (hasSelection) {
      const range = selection.getRangeAt(0);
      const common =
        range.commonAncestorContainer.nodeType === 1
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      table = common?.closest?.('table') || null;
      if (!table) {
        const allRowsGlob = Array.from(
          document.querySelectorAll('tbody tr, tr'),
        );
        const rowsInSel = allRowsGlob.filter((tr) =>
          selection.containsNode(tr, true),
        );
        if (rowsInSel.length) {
          const counts = new Map();
          rowsInSel.forEach((tr) => {
            const t = tr.closest('table');
            if (t) counts.set(t, (counts.get(t) || 0) + 1);
          });
          table =
            Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
            null;
        }
      }
    }
    if (!table) table = getMainTable();
    if (!table) {
      err(TEXTS.no_fields);
      return;
    }

    const idxMap = getTableMap(table);
    if (!idxMap) {
      err(TEXTS.no_fields);
      return;
    }

    let scrollInfo = { used: false, reason: 'none' };
    let totalCount = 0;
    if (!hasSelection) {
      const countEl = pickOne(CFG.SELECTORS.count);
      totalCount = parseIntSafe(countEl?.textContent);
      if (totalCount && totalCount > 50) {
        scrollInfo = await collectWithScroll(
          table,
          Math.min(totalCount, CFG.LIMIT.MAX_ROWS),
        );
      }
    }

    const ROWS_LIMIT = CFG.SCROLL_LIMIT_ROWS;
    const allRows = getAllRows(table);
    const rows = [];
    let truncatedByGlobalLimit = false;

    for (
      let i = 0;
      i < allRows.length &&
      rows.length < ROWS_LIMIT &&
      rows.length < CFG.LIMIT.MAX_ROWS;
      i++
    ) {
      const row = allRows[i];

      if (row.closest('thead')) continue;
      const cells = getCells(row);
      if (!cells.length) continue;

      if (hasSelection && !selection.containsNode(row, true)) continue;

      const vals = [];
      for (const wantedName of WANTED) {
        const colIdx = idxMap.get(wantedName);
        if (colIdx == null) continue;
        const raw = cells[colIdx]?.innerText ?? '';
        const val = prettyValue(
          String(raw).slice(0, CFG.LIMIT.MAX_FIELD_CHARS),
          wantedName,
        );
        if (!isEmptyToken(val)) vals.push(val);
      }
      if (vals.length) rows.push(vals);
    }

    if (!hasSelection) {
      truncatedByGlobalLimit =
        allRows.length > rows.length && rows.length >= ROWS_LIMIT;
    } else {
      truncatedByGlobalLimit = rows.length >= ROWS_LIMIT;
    }

    if (!rows.length) {
      err(TEXTS.no_fields);
      return;
    }

    const lines = rows
      .map((r) => r.join(CFG.OUTPUT.COL_SEP).replace(/\s+$/gu, ''))
      .filter((line) => line.trim() !== '');

    let out = protectLeadingSpaces(lines.join('\n\n'));
    if (out.length > CFG.LIMIT.MAX_TOTAL_OUT)
      out = out.slice(0, CFG.LIMIT.MAX_TOTAL_OUT) + '\n…';
    if (CFG.OUTPUT.WRAP_MARKDOWN) out = '```\n' + out + '\n```';

    const copied = await copy(out);
    if (copied) {
      const hitWindowLimit = rows.length >= ROWS_LIMIT;
      const hitHardMax = rows.length >= CFG.LIMIT.MAX_ROWS;

      if (hasSelection) {
        ok(TEXTS.copy_ok(rows.length));
      } else if (scrollInfo.reason === 'manual') {
        ok(TEXTS.scroll_stopped_rows(rows.length));
      } else if (
        truncatedByGlobalLimit ||
        hitWindowLimit ||
        hitHardMax ||
        scrollInfo.reason === 'scroll_limit'
      ) {
        ok(TEXTS.scroll_limit_rows(rows.length));
      } else {
        ok(TEXTS.not_selected_all(rows.length));
      }
    } else {
      console.log(out);
      err(TEXTS.copy_fail);
    }
  } catch (e) {
    console.error('[Pretty-logs v2] error:', e);
    err(TEXTS.oops);
  } finally {
    clearAllTimers();
  }
})();
