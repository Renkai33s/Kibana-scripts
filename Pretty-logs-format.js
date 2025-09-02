(async () => {
  const wanted = ["time","message.message","message.exception","payload"];
  const norm = s => s?.trim().replace(/\s+/g," ").toLowerCase();

  const isEmptyToken = v => {
    const t = (v ?? "").trim().toLowerCase();
    return !t || t === "-" || t === "—" || t === "–" || t === "n/a" || t === "null";
  };

  const tryParse = s => { try { return JSON.parse(s); } catch { return null; } };

  // Форматирует JSON только у body=... (не трогаем [1755] и т.п.)
  function prettyJsonAfterBody(text) {
    if (!text || typeof text !== "string") return text;
    const m = text.match(/\bbody\s*[:=]\s*/i);
    if (!m) return text;

    let i = m.index + m[0].length;

    // найти первую { или [ после body
    while (i < text.length && text[i] !== "{" && text[i] !== "[") i++;
    if (i >= text.length) return text;

    const open = text[i];
    const close = open === "{" ? "}" : "]";
    // если это массив — форматируем только если внутри есть объект/массив
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
        else if (c === close) {
          depth--;
          if (depth === 0) break;
        }
      }
    }
    if (depth !== 0) return text;

    const candidate = text.slice(i, j + 1);

    // если массив — форматируем только "богатые" (с объектами/массивами внутри)
    if (open === "[" && !/[{\[]/.test(candidate)) return text;

    const obj = tryParse(candidate);
    if (obj == null) return text;

    const pretty = JSON.stringify(obj, null, 2);
    return text.slice(0, i) + "\n" + pretty + "\n" + text.slice(j + 1);
  }

  // Для колонки payload — пробуем весь текст как JSON; если не вышло, пытаемся как в body
  function prettyPayload(text) {
    if (!text || typeof text !== "string") return text;
    const trimmed = text.trim();
    const whole = tryParse(trimmed);
    if (whole != null) return JSON.stringify(whole, null, 2);
    return prettyJsonAfterBody(text);
  }

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

  const extractFromTable = (tableEl, trs) => {
    const bodyTrs = trs.length ? trs : Array.from(tableEl.querySelectorAll("tbody tr, tr"));
    return bodyTrs.map(tr => {
      const tds = Array.from(tr.querySelectorAll("td, th"));
      return wanted.map(w => {
        const i = idxMap.get(norm(w));
        let val = (i != null && tds[i]) ? tds[i].innerText : "";

        // нормализация значений
        if (w === "message.exception") {
          if (isEmptyToken(val)) return "";
          val = (val.split(/\r?\n/)[0] || "").trim();
          return isEmptyToken(val) ? "" : val;
        }

        if (isEmptyToken(val)) return "";

        if (w === "payload") {
          val = prettyPayload(val);
        } else if (w === "message.message") {
          val = prettyJsonAfterBody(val);
        }

        return String(val).trim();
      });
    });
  };

  // 1) обычная <table>
  let table = selectedTr[0]?.closest?.("table");
  if (table && buildIdxMapFromTable(table)) {
    rows = extractFromTable(table, selectedTr);
  }

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
            return wanted.map(w => {
              const i = idxMap.get(norm(w));
              let val = (i != null && cells[i]) ? cells[i].innerText : "";

              if (w === "message.exception") {
                if (isEmptyToken(val)) return "";
                val = (val.split(/\r?\n/)[0] || "").trim();
                return isEmptyToken(val) ? "" : val;
              }

              if (isEmptyToken(val)) return "";

              if (w === "payload") val = prettyPayload(val);
              else if (w === "message.message") val = prettyJsonAfterBody(val);

              return String(val).trim();
            });
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

  // без заголовка; пустые значения — просто пусто; JSON может быть многострочным
  const lines = rows.map(r => r.map(v => (v ?? "").trim()).join("\t"));
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
  alert(ok ? `Скопировано ${rows.length} строк в буфер.` : "Не получилось скопировать в буфер. Результат выведен в консоль.");
  if (!ok) console.log(tsv);
})();
