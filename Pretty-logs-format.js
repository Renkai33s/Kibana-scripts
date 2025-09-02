(async () => {
  const wanted = ["time","message.message","message.exception","payload"];

  const norm = s => s?.trim().replace(/\s+/g," ").toLowerCase();

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    alert("Нет текстового выделения. Выдели строки таблицы и попробуй снова.");
    return;
  }

  // Соберём все <tr>, которые попали в выделение
  const allTr = Array.from(document.querySelectorAll("tr"));
  const selectedTr = allTr.filter(tr => sel.containsNode(tr, true));
  let context = null;

  let rows = [];
  let headers = [];
  let idxMap = new Map();

  const buildIdxMapFromTable = (tableEl) => {
    const ths = tableEl.querySelectorAll("thead th, tr th");
    if (ths.length === 0) return false;
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
        return (i != null && tds[i]) ? tds[i].innerText.trim() : "";
      });
    });
  };

  // 1) Пытаемся как обычный <table>
  let table = selectedTr[0]?.closest?.("table");
  if (table && buildIdxMapFromTable(table)) {
    context = "table";
    rows = extractFromTable(table, selectedTr);
  }

  // 2) Если не получилось — пробуем ARIA grid
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
          context = "grid";
          rows = selectedRoleRows.map(r => {
            const cells = Array.from(r.querySelectorAll('[role="gridcell"], [role="cell"]'));
            return wanted.map(w => {
              const i = idxMap.get(norm(w));
              return (i != null && cells[i]) ? cells[i].innerText.trim() : "";
            });
          });
        }
      }
    }
  }

  // 3) Если всё ещё пусто — пробуем «по ближайшей строке» от якоря выделения
  if (!rows.length) {
    const anchorTr = sel.anchorNode?.parentElement?.closest?.("tr");
    const fallbackTable = anchorTr?.closest?.("table");
    if (fallbackTable && buildIdxMapFromTable(fallbackTable)) {
      context = "table-fallback";
      rows = extractFromTable(fallbackTable, [anchorTr]);
    }
  }

  if (!rows.length) {
    alert("Не удалось понять структуру таблицы или найти нужные столбцы.\nУбедись, что выделены строки, и что таблица имеет заголовки: time, message.message, message.exception, payload.");
    return;
  }

  // Собираем TSV с заголовком
  const headerLine = wanted.join("\t");
  const lines = rows.map(r => r.map(v => v.replace(/\r?\n+/g, " ").trim()).join("\t"));
  const tsv = [headerLine, ...lines].join("\n");

  // Копируем в буфер
  const copyTSV = async text => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Фолбэк через скрытый textarea
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
    alert(`Скопировано ${rows.length} строк в буфер (колонки: ${wanted.join(", ")}).`);
  } else {
    console.log(tsv);
    alert("Не получилось скопировать в буфер (возможно, политика сайта). TSV выведен в консоль.");
  }
})();
