(async () => {
  const wanted = ["time","message.message","message.exception","payload"];
  const norm = s => s?.trim().replace(/\s+/g," ").toLowerCase();

  // === JSON prettifier: ищет JSON-блоки в тексте и форматирует их ===
  function prettyJsonBlocks(text) {
    if (!text || typeof text !== "string") return text;

    const tryPretty = (jsonStr) => {
      try {
        const obj = JSON.parse(jsonStr);
        return JSON.stringify(obj, null, 2); // красиво и с декодированными \uXXXX
      } catch {
        return null;
      }
    };

    // Если вся строка — валидный JSON
    const whole = tryPretty(text.trim());
    if (whole !== null) return whole;

    // Иначе ищем вложенные {...} / [...] (например после "body=")
    let result = "";
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch !== "{" && ch !== "[") {
        result += ch;
        i++;
        continue;
      }

      // Пытаемся вырезать сбалансированный JSON-блок, учитывая строки/экранирование
      const open = ch;
      const close = (ch === "{") ? "}" : "]";
      let depth = 0;
      let j = i;
      let inStr = false;
      let strQuote = null;
      let escaped = false;

      for (; j < text.length; j++) {
        const c = text[j];

        if (inStr) {
          if (escaped) {
            escaped = false;
          } else if (c === "\\") {
            escaped = true;
          } else if (c === strQuote) {
            inStr = false;
            strQuote = null;
          }
        } else {
          if (c === '"' || c === "'") {
            // JSON официально поддерживает только двойные кавычки, но некоторые логи кладут одинарные — попробуем аккуратно
            inStr = true;
            strQuote = c;
          } else if (c === open) {
            depth++;
          } else if (c === close) {
            depth--;
            if (depth === 0) {
              // Кандидат найден
              const candidate = text.slice(i, j + 1);
              const pretty = tryPretty(candidate);
              if (pretty !== null) {
                result += "\n" + pretty + "\n";
                i = j + 1;
                break;
              }
            }
          }
        }
      }

      if (j >= text.length) {
        // не получилось — просто добавить символ и идти дальше
        result += text[i];
        i++;
      }
    }

    return result;
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    alert("Нет текстового выделения. Выдели строки таблицы и попробуй снова.");
    return;
  }

  // Собираем выделенные TR для <table>
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
        let val = (i != null && tds[i]) ? tds[i].innerText.trim() : "";
        if (w === "message.exception") val = val.split(/\r?\n/)[0] || "";
        // форматируем JSON (если валиден) в любом поле
        val = prettyJsonBlocks(val);
        return val;
      });
    });
  };

  // 1) как обычная таблица
  let table = selectedTr[0]?.closest?.("table");
  if (table && buildIdxMapFromTable(table)) {
    rows = extractFromTable(table, selectedTr);
  }

  // 2) ARIA grid (role="grid"/"table")
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
              let val = (i != null && cells[i]) ? cells[i].innerText.trim() : "";
              if (w === "message.exception") val = val.split(/\r?\n/)[0] || "";
              val = prettyJsonBlocks(val);
              return val;
            });
          });
        }
      }
    }
  }

  // 3) fallback по ближайшей строке
  if (!rows.length) {
    const anchorTr = sel.anchorNode?.parentElement?.closest?.("tr");
    const fbTable = anchorTr?.closest?.("table");
    if (fbTable && buildIdxMapFromTable(fbTable)) {
      rows = extractFromTable(fbTable, [anchorTr]);
    }
  }

  if (!rows.length) {
    alert("Не удалось найти данные. Убедись, что выделены строки таблицы с колонками time, message.message, message.exception, payload.");
    return;
  }

  // ВАЖНО: больше не убираем переводы строк внутри ячеек — чтобы сохранить красивый JSON.
  // Каждая строка — это набор полей, разделённых табами; в полях может быть многострочный текст.
  const lines = rows.map(r => r.map(v => (v ?? "").trim()).join("\t"));
  const tsv = lines.join("\n");

  // Копируем как есть (многострочный JSON сохранится)
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
    alert(`Скопировано ${rows.length} строк в буфер (с форматированием JSON).`);
  } else {
    console.log(tsv);
    alert("Не получилось скопировать в буфер. Результат выведен в консоль.");
  }
})();
