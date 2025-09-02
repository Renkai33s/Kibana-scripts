(function(){
  // --- Система уведомлений ---
  if(!window.__notifContainer){
    const c = document.createElement('div');
    c.id = 'notif-container';
    c.style.position = 'fixed';
    c.style.bottom = '20px';
    c.style.right = '20px';
    c.style.width = 'auto';
    c.style.zIndex = 999999;
    document.body.appendChild(c);
    window.__notifContainer = c;
    window.__currentNotif = null;
  }

  function showMessage(msg, isError=false, isSuccess=false){
    if(window.__currentNotif){ window.__currentNotif.remove(); window.__currentNotif=null; }
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.padding = '10px 15px';
    d.style.borderRadius = '8px';
    d.style.background = isError ? '#ff4d4f' : isSuccess ? '#52c41a' : '#3498db';
    d.style.color = 'white';
    d.style.fontFamily = 'sans-serif';
    d.style.fontSize = '14px';
    d.style.minWidth = '120px';
    d.style.textAlign = 'center';
    d.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    window.__notifContainer.appendChild(d);
    window.__currentNotif = d;
    setTimeout(()=>{ if(window.__currentNotif===d){ d.remove(); window.__currentNotif=null } },2000);
  }
  const showError = (m)=>showMessage(m,true,false);
  const showSuccess = (m)=>showMessage(m,false,true);

  // ---------- УТИЛИТЫ ----------

  // Поиск сегмента body=... на верхнем уровне (вне кавычек и скобок).
  function findBodySegment(str){
    let depth = 0; // {},[],()
    let inQuote = null; // '"' | "'"
    for(let i=0;i<str.length;i++){
      const ch = str[i];
      const prev = str[i-1];

      // внутри кавычек
      if(inQuote){
        if(ch === inQuote && prev !== '\\') inQuote = null;
        continue;
      }
      // открывающие/закрывающие
      if(ch === '"' || ch === "'"){ inQuote = ch; continue; }
      if(ch === '{' || ch === '[' || ch === '('){ depth++; continue; }
      if(ch === '}' || ch === ']' || ch === ')'){ depth = Math.max(0, depth-1); continue; }

      // только на верхнем уровне пытаемся найти body=
      if(depth === 0){
        // пропустим пробелы
        if((ch === 'b' || ch === 'B') && /^body\s*=/.test(str.slice(i).toLowerCase())){
          // нашли начало "body"
          const startKey = i;
          // продвинемся до '='
          let j = i + 4;
          while(j < str.length && /\s/.test(str[j])) j++;
          if(str[j] !== '=') { i = j; continue; }
          j++; // позиция первого символа значения
          while(j < str.length && /\s/.test(str[j])) j++;
          if(j >= str.length) return null;

          // теперь считываем значение body
          let valStart = j;
          let valEnd = j;
          let vDepth = 0;
          let vInQuote = null;

          const first = str[j];
          if(first === '"' || first === "'"){
            // читаем до незакрытой кавычки
            vInQuote = first;
            valEnd = j+1;
            while(valEnd < str.length){
              const c = str[valEnd];
              const p = str[valEnd-1];
              if(vInQuote){
                if(c === vInQuote && p !== '\\'){ vInQuote = null; valEnd++; break; }
                valEnd++;
                continue;
              }
              valEnd++;
            }
          } else if(first === '{' || first === '[' || first === '('){
            // сбалансированные скобки
            vDepth = 1;
            valEnd = j+1;
            while(valEnd < str.length && vDepth > 0){
              const c = str[valEnd];
              const p = str[valEnd-1];
              if(!vInQuote && (c === '"' || c === "'")){ vInQuote = c; valEnd++; continue; }
              if(vInQuote){ if(c === vInQuote && p !== '\\') vInQuote = null; valEnd++; continue; }
              if(c === '{' || c === '[' || c === '(') vDepth++;
              else if(c === '}' || c === ']' || c === ')') vDepth--;
              valEnd++;
            }
          } else {
            // "простое" значение — до следующей запятой на верхнем уровне
            valEnd = j;
            while(valEnd < str.length){
              const c = str[valEnd];
              if(c === ',') break;
              valEnd++;
            }
          }

          const fullStart = startKey; // индекс начала "body"
          const fullEnd = valEnd;     // конец значения (не включая следующую запятую)
          const rawVal = str.slice(valStart, valEnd);
          return {fullStart, fullEnd, valStart, valEnd, rawVal};
        }
      }
    }
    return null;
  }

  function tryPrettyJson(raw){
    let s = raw.trim();

    // если значение в кавычках — снимем и разэкраним
    let quoted = false;
    if((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))){
      quoted = true;
      s = s.slice(1, -1);
      // заменим \" и т.п.
      try { s = JSON.parse('"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'); } catch(_){}
    }

    // если s — JSON-объект/массив
    let parsed = null;
    try { parsed = JSON.parse(s); } catch(_){}
    if(parsed !== null){
      const pretty = JSON.stringify(parsed, null, 2);
      return { pretty: 'body:\n' + pretty.split('\n').map(l=>'  '+l).join('\n'), changed:true };
    }

    // не JSON — вернём аккуратно
    if(quoted){
      return { pretty: `body: "${s}"`, changed:true };
    }
    return { pretty: `body: ${raw.trim()}`, changed:true };
  }

  // Заменить "body=..." на многострочный формат "body:\n  ..."
  function formatBodyInText(text){
    const hit = findBodySegment(text);
    if(!hit) return null;
    const {fullStart, fullEnd, rawVal} = hit;

    const {pretty, changed} = tryPrettyJson(rawVal);
    if(!changed) return null;

    // Найдём начало "body" (ключ), чтобы заменить "body=значение"
    // назад от fullStart до 'b' в "body"
    // у нас fullStart уже указывает на начало "body"
    const keyStart = fullStart;
    // сдвинем конец до fullEnd, плюс если дальше сразу идёт запятая — оставим запятую и пробел на месте
    let tail = text.slice(fullEnd);
    let prefix = text.slice(0, keyStart);
    // вычищаем возможные пробелы/символы вокруг
    // удаляем "body" и всё до fullEnd
    const replaced = prefix + pretty + tail;
    return replaced;
  }

  // ---------- ОСНОВНАЯ ЛОГИКА ----------
  try{
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0 || !sel.toString().trim()){ showError("Логи не выделены"); return; }

    const selectedText = sel.toString();

    // Попытка форматировать ТОЛЬКО body в «сыром» тексте
    const rewritten = formatBodyInText(selectedText);
    if(rewritten){
      navigator.clipboard.writeText(rewritten)
        .then(()=>showSuccess("body отформатирован и скопирован"))
        .catch(()=>showError("Ошибка при копировании"));
      return;
    }

    // Если не нашли body в простом тексте — пробуем таблицу
    const noiseRe = /^(INFO|DEBUG|WARN|WARNING|ERROR|TRACE|-|–|—)$/i;
    const trs = Array.from(document.querySelectorAll('tr'));
    const out = [];

    trs.forEach(tr=>{
      const cells = Array.from(tr.querySelectorAll('td,th'));
      const selected = cells.filter(td=>sel.containsNode(td,true));
      if(selected.length>0){
        const table = tr.closest('table');
        const headerRow =
          table.querySelector('thead tr') ||
          Array.from(table.querySelectorAll('tr')).find(rw=>rw.querySelectorAll('th').length>0) ||
          table.querySelector('tr');
        const ths = Array.from(headerRow.querySelectorAll('th,td'));

        function getCellText(key){
          const idx = ths.findIndex(th=>th.textContent.trim().toLowerCase()===key);
          if(idx>=0){
            const td = cells[idx];
            if(td && td.textContent.trim() && !noiseRe.test(td.textContent.trim()) && sel.containsNode(td,true))
              return td.textContent.trim();
          }
          return null;
        }

        const time = getCellText('time');
        const message = getCellText('message.message');
        let exception = getCellText('message.exception');
        if(exception) exception = exception.split('\n')[0];

        let payload = getCellText('payload');
        if(payload){
          const fmt = formatBodyInText(payload);
          if(fmt) payload = fmt;
        }

        const parts = [time, message, exception, payload].filter(Boolean);
        const line = parts.join('  ');
        if(line) out.push(line);
      }
    });

    if(out.length===0){ showError("Не найдено поля body для форматирования"); return; }

    navigator.clipboard.writeText(out.join('\n'))
      .then(()=>showSuccess("Логи скопированы (body форматирован)"))
      .catch(()=>showError("Ошибка при копировании"));

  } catch(e){
    console.error(e);
    showError("Что-то пошло не так");
  }
})();
