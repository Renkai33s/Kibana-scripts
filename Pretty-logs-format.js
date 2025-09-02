(async () => {
  const wanted = ["time","message.message","message.exception","payload"];
  const norm = s => s?.trim().replace(/\s+/g," ").toLowerCase();

  const isEmptyToken = v => {
    const t = (v ?? "").trim().toLowerCase();
    return !t || t === "-" || t === "—" || t === "–" || t === "n/a" || t === "null";
  };

  const tryParseJson = s => { try { return JSON.parse(s); } catch { return null; } };

  // ---------- XML pretty-print ----------
  const parseXml = (xmlStr) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, "text/xml");
      const err = doc.getElementsByTagName("parsererror")[0];
      if (err) return null;
      // serialize to get normalized xml
      const ser = new XMLSerializer().serializeToString(doc);
      return ser;
    } catch { return null; }
  };

  const indentXml = (xmlStr) => {
    // normalize tag boundaries
    let s = xmlStr.replace(/>\s+</g, '><');
    // line break between tags/comments/decls
    s = s
      .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
      .replace(/(\?>)(<)/g, '$1\n$2')
      .replace(/(--\>)(<)/g, '$1\n$2');

    const lines = s.split('\n').map(l => l.trim()).filter(l => l.length);
    let indent = 0;
    const out = [];
    for (let line of lines) {
      const isClosing = /^<\/[^>]+>/.test(line);
      const isSelf = /\/>$/.test(line) || /^<[^>]+\/>$/.test(line);
      const isDecl = /^<\?xml/.test(line);
      const isComment = /^<!--/.test(line) && /-->$/.test(line);
      if (isClosing) indent = Math.max(indent - 1, 0);
      const pad = '  '.repeat(indent);
      out.push(pad + line);
      if (!isClosing && !isSelf && !isDecl && !isComment && /^<[^!?][^>]*>$/.test(line)) {
        indent++;
      }
    }
    return out.join('\n');
  };

  // Вырезает первый XML-блок из текста (начиная с первой '<'), валидирует, красиво форматирует и вставляет обратно.
  function prettyXmlInText(text) {
    if (!text || typeof text !== "string") return text;
    const firstLt = text.indexOf('<');
    if (firstLt === -1) return text;

    // Берём от первой < до последнего > и пробуем как XML
    const lastGt = text.lastIndexOf('>');
    if (lastGt <= firstLt) return text;

    const candidate = text.slice(firstLt, lastGt + 1);
    const normalized = parseXml(candidate);
    if (!normalized) return text;

    const pretty = indentXml(normalized);
    // Вставляем без лишнего завершающего \n
    return text.slice(0, firstLt) + "\n" + pretty + "\n" + text.slice(lastGt + 1);
  }

  // ---------- JSON pretty (как раньше) ----------
  function prettyJsonAfterBody(text) {
    if (!text || typeof text !== "string") return text;
    const m = text.match(/\bbody\s*[:=]\s*/i);
    if (!m) return text;
    let i = m.index + m[0].length;
    while (i < text.length && text[i] !== "{" && text[i] !== "[") i++;
    if (i >= text.length) return text;

    const open = text[i];
    const close = open === "{" ? "}" : "]";
    let depth = 0, j = i, inStr = false, escaped = false;

    for (; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (escaped) { escaped = false; }
        else if (c === "\\") { escaped = true; }
        else if (c === '"') { inStr = false; }
      } else {
        if (c === '"') inStr = true;
        else if (c === open) depth++;
        else if (c === close) { depth--; if (depth === 0) break; }
      }
    }
    if (depth !== 0) return text;

    const candidate = text.slice(i, j + 1);
    if (open === "[" && !/[{\[]/.test(candidate)) return text; // простые массивы (типа [1755]) не трогаем

    const obj = tryParseJson(candidate);
    if (obj == null) return text;

    const pretty = JSON.stringify(obj, null, 2);
    return text.slice(0, i) + "\n" + pretty + text.slice(j + 1);
  }

  function prettyPayload(text) {
    if (!text || typeof text !== "string") return text;
    const trimmed = text.trim();
    const whole = tryParseJson(trimmed);
    if (whole != null) return JSON.stringify(whole, null, 2);
    // не JSON — пробуем XML целиком
    const asXml = parseXml(trimmed);
    if (asXml) return indentXml(asXml);
    // иначе пробуем JSON в стиле body=...
    const bodyJson = prettyJsonAfterBody(text);
    if (bodyJson !== text) return bodyJson;
    // иначе пробуем XML-фрагмент в тексте
    return prettyXmlInText(text);
  }

  // -------------------------------------

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    alert("Нет текстового выделения. Выдели строки таблицы и попробуй снова.");
    return;
  }

  const allTr = Array.from(document.querySelectorAll("tr"));
  const selectedTr = allTr.filter(tr => sel.containsNode(tr, true));
  let rows = [], headers = [], idxMap = new Map();

  const buildIdxMapFromTable = (tableEl) => {
    const ths = tableEl.querySelectorAll("thead th, tr th");
    if (!ths.length) return false;
    headers = Array.from(ths).map(th => norm(th.textContent));
    wanted.forEach(w => {
      const i = headers.findIndex(h => h === norm(w));
      if (i !== -1) idxMap.set(norm(w), i);
    });
    return idxMap.size > 0;
  };

  const processCell = (w, raw) => {
    let val = (raw ?? "").toString();
    if (w === "message.exception") {
      if (isEmptyToken(val)) return "";
      val = (val.split(/\r?\n/)[0] || "").trim();
      if (isEmptyToken(val)) return "";
      return val;
    }
    if (isEmptyToken(val)) return "";

    if (w === "payload") {
      val = prettyPayload(val);
    } else if (w === "message.message") {
      // сначала JSON body=..., затем попытка красиво отформатировать XML-фрагмент (например SOAP)
      const afterJson = prettyJsonAfterBody(val);
      val = prettyXmlInText(afterJson);
    }
    return String(val).trim();
  };

  const extractFromTable = (tableEl, trs) => {
    const bodyTrs = trs.length ? trs : Array.from(tableEl.querySelectorAll("tbody tr, tr"));
    return bodyTrs.map(tr => {
      const tds = Array.from(tr.querySelectorAll("td, th"));
      const vals = wanted.map(w => {
        const i = idxMap.get(norm(w));
        const raw = (i != null && tds[i]) ? tds[i].innerText : "";
        return processCell(w, raw);
      });
      // выбрасываем пустые поля — чтобы не было хвостовых табов/пустых колонок
      return vals.filter(v => (v ?? "").trim() !== "");
    });
  };

  // 1) обычная таблица
  let table = selectedTr[0]?.closest?.("table");
  if (table && buildIdxMapFromTable(table)) rows = extractFromTable(table, selectedTr);

  // 2) ARIA grid
  if (!rows.length) {
    const roleRowsAll = Array.from(document.querySelectorAll('[role="row"]'));
    const selectedRoleRows = roleRowsAll.filter(r => sel.containsNode(r, true));
    if (selectedRoleRows.length) {
      const grid = selectedRoleRows[0].closest('[role="grid"], [role="table"]') || document;
      const headersEls = grid.querySelectorAll('[role="columnheader"]');
      if (headersEls.length) {
        headers = Array.from(headersEls).map(el => norm(el.textContent));
        wanted.forEach(w => {
          const i = headers.findIndex(h => h === norm(w));
          if (i !== -1) idxMap.set(norm(w), i);
        });
        if (idxMap.size) {
          rows = selectedRoleRows.map(r => {
            const cells = Array.from(r.querySelectorAll('[role="gridcell"], [role="cell"]'));
            const vals = wanted.map(w => {
              const i = idxMap.get(norm(w));
              const raw = (i != null && cells[i]) ? cells[i].innerText : "";
              return processCell(w, raw);
            });
            return vals.filter(v => (v ?? "").trim() !== "");
          });
        }
      }
    }
  }

  // 3) fallback
  if (!rows.length) {
    const anchorTr = sel.anchorNode?.parentElement?.closest?.("tr");
    const fbTable = anchorTr?.closest?.("table");
    if (fbTable && buildIdxMapFromTable(fbTable)) {
      rows = extractFromTable(fbTable, [anchorTr]);
    }
  }

  if (!rows.length) {
    alert("Не удалось найти данные. Убедись, что выделены строки и есть колонки time, message.message, message.exception, payload.");
    return;
  }

  // Только непустые поля, без хвостовых табов и лишних переводов
  const lines = rows
    .map(r => r.join("\t").replace(/\s+$/g, ""))   // trimEnd без среза полезных \n внутри XML/JSON
    .filter(line => line.trim() !== "");

  const tsv = lines.join("\n");

  const copyTSV = async text => {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.top = "-1000px";
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
    } catch { return false; }
  };

  const ok = await copyTSV(tsv);
  if (!ok) console.log(tsv);
  alert(ok ? `Скопировано ${lines.length} строк в буфер.` : "Не получилось скопировать в буфер. Результат выведен в консоль.");
})();
