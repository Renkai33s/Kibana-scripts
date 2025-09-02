(async () => {
  const wanted = ["time","message.message","message.exception","payload"];
  const norm = s => s?.trim().replace(/\s+/g," ").toLowerCase();

  const isPlaceholderEmpty = (s) => {
    const t = (s ?? "").trim();
    return t === "" || t === "-" || t === "—" || t === "–";
  };

  const sanitizeForTSV = s =>
    s.replace(/\t/g, "  ")
     .replace(/\r?\n/g, " ⏎ ")
     .replace(/\s{3,}/g, " ")
     .trim();

  const prettyJSON = (obj) => JSON.stringify(obj, null, 2);

  // Сканер сбалансированных диапазонов для {…} и […], возвращает массив [start,end] включая скобки
  const findBalancedRanges = (text, openCh, closeCh) => {
    const ranges = [];
    const stack = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === openCh) stack.push(i);
      else if (ch === closeCh && stack.length) {
        const start = stack.pop();
        ranges.push([start, i]);
      }
    }
    return ranges.sort((a,b) => a[0]-b[0]);
  };

  // Пытаемся внутри строки красиво отформатировать все валидные JSON-фрагменты
  const prettyInlineJSONs = (t) => {
    let s = t;
    // Собираем диапазоны по двум типам скобок
    const ranges = [
      ...findBalancedRanges(s, "{", "}"),
      ...findBalancedRanges(s, "[", "]"),
    ].sort((a,b) => a[0]-b[0]);

    if (!ranges.length) return null;

    // Заменяем с конца, чтобы не сдвигать индексы
    for (let i = ranges.length - 1; i >= 0; i--) {
      const [start, end] = ranges[i];
      const frag = s.slice(start, end + 1);
      try {
        const obj = JSON.parse(frag);
        const pretty = prettyJSON(obj);
        s = s.slice(0, start) + pretty + s.slice(end + 1);
      } catch {
        // не JSON — пропускаем
      }
    }
    return s === t ? null : s;
  };

  // Наивный pretty для встроенного XML (если встретится)
  const prettyInlineXML = (t) => {
    const start = t.indexOf("<");
    const end = t.lastIndexOf(">");
    if (start === -1 || end <= start) return null;
    const frag = t.slice(start, end + 1).trim();
    if (!/^<[^>]+>/.test(frag)) return null;
    try {
      const compact = frag.replace(/>\s+</g, "><");
      const parts = compact.split(/(?=<)|(?<=>)/g).filter(Boolean);
      let indent = 0, out = [];
      for (const p of parts) {
        if (/^<\/[^>]+>$/.test(p)) indent = Math.max(indent - 1, 0);
        out.push("  ".repeat(indent) + p);
        if (/^<[^!?/][^>]*[^/]>$/.test(p)) indent++;
      }
      const pretty = out.join("\n");
      return t.slice(0, start) + pretty + t.slice(end + 1);
    } catch { return null; }
  };

  const prettyCell = (val, key) => {
    if (isPlaceholderEmpty(val)) return ""; // плейсхолдеры считаем пустыми
    let v = val ?? "";

    // Только первая строка для message.exception
    if (key === "message.exception") {
      v = v.split(/\r?\n/)[0] || "";
      if (isPlaceholderEmpty(v)) return "";
    }

    // 1) Пытаемся распарсить весь текст как JSON
    try {
      const trimmed = v.trim();
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        const obj = JSON.parse(trimmed);
        return sanitizeForTSV(prettyJSON(obj));
      }
    } catch { /* not whole JSON */ }

    // 2) Пытаемся отформатировать все встроенные JSON-фрагменты
    const j = prettyInlineJSONs(v);
    if (j) return sanitizeForTSV(j);

    // 3) Пытаемся для XML (встроенный)
    const x = prettyInlineXML(v);
    if (x) return sanitizeForTSV(x);

    // 4) Обычный текст
    return sanitizeForTSV(v);
  };

  // ===== выбор строк =====
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    alert("Нет текстового выделения. Выдели строки таблицы и попробуй снова.");
    return;
  }

  const allTr = Array.from(document.querySelectorAll("tr"));
  const selectedTr = allTr.filter(tr => sel.containsNode(tr, true));
  let rows = [], headers = [], idxMap = new Map();

  const buildIdxMap = (tableEl) => {
    const ths = tableEl.querySelectorAll("thead th, tr th");
    if (!ths.length) return false;
    headers = Array.from(ths).map(th => norm(th.textContent));
    wanted.forEach(w => {
      const i = headers.findIndex(h => h === norm(w));
      if (i !== -1) idxMap.set(norm(w), i);
    });
    return idxMap.size > 0;
  };

  const extractRows = (tableEl, trs) => {
    const bodyTrs = trs.length ? trs : Array.from(tableEl.querySelectorAll("tbody tr, tr"));
    return bodyTrs.map(tr => {
      const tds = Array.from(tr.querySelectorAll("td, th"));
      return wanted.map(w => {
        const i = idxMap.get(norm(w));
        const raw = (i != null && tds[i]) ? tds[i].innerText : "";
        return prettyCell(raw, w);
      });
    });
  };

  // основной поиск по таблице
  let table = selectedTr[0]?.closest?.("table");
  if (table && buildIdxMap(table)) rows = extractRows(table, selectedTr);

  // fallback
  if (!rows.length) {
    const anchorTr = sel.anchorNode?.parentElement?.closest?.("tr");
    const fbTable = anchorTr?.closest?.("table");
    if (fbTable && buildIdxMap(fbTable)) rows = extractRows(fbTable, [anchorTr]);
  }

  if (!rows.length) {
    alert("Не удалось найти данные. Убедись, что выделены строки таблицы с колонками time, message.message, message.exception, payload.");
    return;
  }

  // TSV без заголовка; пустые ячейки остаются пустыми
  const lines = rows.map(r => r.join("\t"));
  const tsv = lines.join("\n");

  const copyTSV = async text => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.top = "-1000px";
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
    } catch { return false; }
  };

  const ok = await copyTSV(tsv);
  if (ok) alert(`Скопировано ${rows.length} строк в буфер.`);
  else { console.log(tsv); alert("Не получилось скопировать в буфер. Результат выведен в консоль."); }
})();
