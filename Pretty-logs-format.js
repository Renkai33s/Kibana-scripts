(async () => {
  const wanted = ["time","message.message","message.exception","payload"];
  const norm = s => s?.trim().replace(/\s+/g," ").toLowerCase();

  // Пустые токены одинаково для всех колонок
  const isEmptyToken = v => {
    const t = (v ?? "").toString().trim().toLowerCase();
    return !t || t === "-" || t === "—" || t === "–" || t === "n/a" || t === "null";
  };

  // ---------- JSON prettify ----------
  const tryParseJson = s => { try { return JSON.parse(s); } catch { return null; } };

  // 1) если вся ячейка — JSON
  const prettyWholeJson = text => {
    const obj = tryParseJson(text.trim());
    return obj != null ? JSON.stringify(obj, null, 2) : null;
  };

  // 2) формат всех сбалансированных {...} / [...] фрагментов внутри текста
  const prettyAnyJsonFragments = (text) => {
    let s = text;
    let out = "";
    let i = 0;
    let changed = false;

    while (i < s.length) {
      const ch = s[i];
      if (ch !== "{" && ch !== "[") {
        out += ch;
        i++;
        continue;
      }
      const open = ch;
      const close = open === "{" ? "}" : "]";
      let depth = 0, j = i, inStr = false, esc = false;

      for (; j < s.length; j++) {
        const c = s[j];
        if (inStr) {
          if (esc) esc = false;
          else if (c === "\\") esc = true;
          else if (c === '"') inStr = false;
        } else {
          if (c === '"') inStr = true;
          else if (c === open) depth++;
          else if (c === close) { depth--; if (depth === 0) break; }
        }
      }

      if (depth !== 0) { // несбалансировано — просто символ
        out += s[i++];
        continue;
      }

      const candidate = s.slice(i, j + 1);

      // Пропускаем «простые» массивы без объектов/массивов внутри (например, [1755])
      if (open === "[" && !/[{\[]/.test(candidate)) {
        out += candidate;
        i = j + 1;
        continue;
      }

      const obj = tryParseJson(candidate);
      if (obj != null) {
        const pretty = JSON.stringify(obj, null, 2);
        out += "\n" + pretty;            // перенос перед форматированным блоком
        changed = true;
      } else {
        out += candidate;                 // не JSON — оставляем как есть
      }
      i = j + 1;
    }

    return changed ? out : null;
  };

  // ---------- XML prettify ----------
  const parseXml = (xmlStr) => {
    try {
      const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
      if (doc.getElementsByTagName("parsererror")[0]) return null;
      return new XMLSerializer().serializeToString(doc); // нормализуем
    } catch { return null; }
  };

  const indentXml = (xmlStr) => {
    let s = xmlStr.replace(/>\s+</g, '><')
                  .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
                  .replace(/(\?>)(<)/g, '$1\n$2')
                  .replace(/(--\>)(<)/g, '$1\n$2');
    const lines = s.split('\n').map(l => l.trim()).filter(Boolean);
    let indent = 0;
    const out = [];
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
  };

  // Форматирует первый/крупнейший XML-фрагмент в тексте
  const prettyXmlInText = (text) => {
    const firstLt = text.indexOf('<');
    if (firstLt === -1) return null;
    const lastGt = text.lastIndexOf('>');
    if (lastGt <= firstLt) return null;

    const candidate = text.slice(firstLt, lastGt + 1);
    const normalized = parseXml(candidate);
    if (!normalized) return null;

    const pretty = indentXml(normalized);
    const before = text.slice(0, firstLt).replace(/\s+$/,'');
    const after  = text.slice(lastGt + 1).replace(/^\s+/,'');
    return (before ? before + "\n" : "") + pretty + (after ? "\n" + after : "");
  };

  // Универсальный форматтер для любой ячейки: JSON (целый → фрагменты) потом XML
  const prettyValue = (raw) => {
    let v = (raw ?? "").toString();
    if (isEmptyToken(v)) return "";       // « - » и аналоги → затираем

    // 1) целиком JSON
    const wj = prettyWholeJson(v);
    if (wj !== null) return wj.trim();

    // 2) любые JSON-фрагменты
    const jf = prettyAnyJsonFragments(v);
    if (jf !== null) return jf.trim();

    // 3) целиком XML
    const wx = parseXml(v.trim());
    if (wx) return indentXml(wx).trim();

    // 4) XML-фрагмент в тексте (например SOAP внутри лога)
    const fx = prettyXmlInText(v);
    if (fx !== null) return fx.trim();

    // Не распознали — возвращаем подрезав края (не трогая внутренние \n)
    return v.trim();
  };

  // ---------------- table/grid извлечение ----------------
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
      const vals = wanted.map(w => {
        const i = idxMap.get(norm(w));
        const raw = (i != null && tds[i]) ? tds[i].innerText : "";
        return prettyValue(raw);
      });
      // выбрасываем пустые поля целиком
      return vals.filter(v => v !== "");
    });
  };

  // 1) обычная <table>
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
              return prettyValue(raw);
            });
            return vals.filter(v => v !== "");
          });
        }
      }
    }
  }

  // 3) fallback
  if (!rows.length) {
    const anchorTr = sel.anchorNode?.parentElement?.closest?.("tr");
    const fbTable = anchorTr?.closest?.("table");
    if (fbTable && buildIdxMapFromTable(fbTable)) rows = extractFromTable(fbTable, [anchorTr]);
  }

  if (!rows.length) {
    alert("Не удалось найти данные. Убедись, что выделены строки и есть колонки time, message.message, message.exception, payload.");
    return;
  }

  // Формируем строки: только непустые поля; внутри ячеек сохраняем многострочные JSON/XML
  const lines = rows
    .map(r => r.join("\t").replace(/[ \t]+$/g, "")) // подрезаем хвостовые пробелы/табы
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
