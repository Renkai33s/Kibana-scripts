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

  // ===== Pretty helpers =====
  const prettyJSON = (obj) => JSON.stringify(obj, null, 2);

  // пытаемся распарсить JSON, если он целиком строка
  const tryWholeJSON = (t) => {
    const s = t.trim();
    if (!((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]")))) return null;
    try { return prettyJSON(JSON.parse(s)); } catch { return null; }
  };

  // ищем JSON-фрагмент внутри текста (жадно от первой "{" / "[" к ближайшему валидному завершению)
  const tryInlineJSON = (t) => {
    const text = t;
    const scan = (open, close) => {
      const start = text.indexOf(open);
      if (start === -1) return null;
      for (let end = text.lastIndexOf(close); end > start; end = text.lastIndexOf(close, end - 1)) {
        const frag = text.slice(start, end + 1);
        try {
          const obj = JSON.parse(frag);
          const pretty = prettyJSON(obj);
          return text.slice(0, start) + pretty + text.slice(end + 1);
        } catch {/* keep searching */}
      }
      return null;
    };
    return scan("{", "}") ?? scan("[", "]");
  };

  // простой pretty для XML (встроенный фрагмент)
  const tryInlineXML = (t) => {
    const start = t.indexOf("<");
    const end = t.lastIndexOf(">");
    if (start === -1 || end <= start) return null;
    const frag = t.slice(start, end + 1).trim();
    // чуть-чуть отсечём явный не-XML
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
    if (isPlaceholderEmpty(val)) return ""; // плейсхолдеры как пустые
    let v = val ?? "";
    // message.exception — только первая строка
    if (key === "message.exception") {
      v = v.split(/\r?\n/)[0] || "";
      if (isPlaceholderEmpty(v)) return "";
    }
    // сначала пробуем весь JSON, потом встроенный JSON, потом XML
    const whole = tryWholeJSON(v);
    if (whole) return sanitizeForTSV(whole);
    const inJson = tryInlineJSON(v);
    if (inJson) return sanitizeForTSV(inJson);
    const inXml = tryInlineXML(v);
    if (inXml) return sanitizeForTSV(inXml);
    // обычный текст
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

  // fallback: если не нашёл
  if (!rows.length) {
    const anchorTr = sel.anchorNode?.parentElement?.closest?.("tr");
    const fbTable = anchorTr?.closest?.("table");
    if (fbTable && buildIdxMap(fbTable)) rows = extractRows(fbTable, [anchorTr]);
  }

  if (!rows.length) {
    alert("Не удалось найти данные. Убедись, что выделены строки таблицы с колонками time, message.message, message.exception, payload.");
    return;
  }

  // формируем TSV без заголовка (пустые ячейки остаются пустыми)
  const lines = rows.map(r => r.join("\t"));
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
  if (ok) alert(`Скопировано ${rows.length} строк в буфер.`);
  else { console.log(tsv); alert("Не получилось скопировать в буфер. Результат выведен в консоль."); }
})();
