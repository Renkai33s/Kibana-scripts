(async () => {
  const wanted = ["time","message.message","message.exception","payload"];
  const norm = s => s?.trim().replace(/\s+/g," ").toLowerCase();

  const sanitizeForTSV = s =>
    s.replace(/\t/g, "  ")
     .replace(/\r?\n/g, " ⏎ ")
     .replace(/\s{3,}/g, " ")
     .trim();

  const tryPrettyJSON = (s) => {
    try {
      // быстрый фильтр чтобы не парсить всё подряд
      const t = s.trim();
      if (!((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]")))) return null;
      const obj = JSON.parse(t);
      return JSON.stringify(obj, null, 2);
    } catch { return null; }
  };

  const tryPrettyXML = (s) => {
    const t = s.trim();
    if (!(t.startsWith("<") && t.endsWith(">"))) return null;
    try {
      const parts = t.replace(/>\s+</g, "><").split(/(?=<)|(?<=>)/g).filter(Boolean);
      let indent = 0, out = [];
      for (const p of parts) {
        if (/^<\/[^>]+>$/.test(p)) indent = Math.max(indent - 1, 0);
        out.push("  ".repeat(indent) + p);
        if (/^<[^!?/][^>]*[^/]>$/.test(p)) indent++;
      }
      return out.join("\n");
    } catch { return null; }
  };

  const prettyCell = (val, key) => {
    if (!val) return ""; // пустые — не копируем
    // special rule for message.exception: только первая строка
    if (key === "message.exception") {
      val = val.split(/\r?\n/)[0] || "";
      if (!val) return "";
    }
    // попытка красиво отформатировать код
    const asJSON = tryPrettyJSON(val);
    if (asJSON) return sanitizeForTSV(asJSON);
    const asXML = tryPrettyXML(val);
    if (asXML) return sanitizeForTSV(asXML);
    // обычный текст
    return sanitizeForTSV(val);
  };

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
        let val = (i != null && tds[i]) ? tds[i].innerText : "";
        return prettyCell(val, w);
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
    if (fbTable && buildIdxMap(fbTable)) {
      rows = extractRows(fbTable, [anchorTr]);
    }
  }

  if (!rows.length) {
    alert("Не удалось найти данные. Убедись, что выделены строки таблицы с колонками time, message.message, message.exception, payload.");
    return;
  }

  // формируем TSV без заголовка
  const lines = rows.map(r => r.join("\t"));
  const tsv = lines.join("\n");

  const copyTSV = async text => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const ok = await copyTSV(tsv);
  if (ok) {
    alert(`Скопировано ${rows.length} строк в буфер.`);
  } else {
    console.log(tsv);
    alert("Не получилось скопировать в буфер. Результат выведен в консоль.");
  }
})();
