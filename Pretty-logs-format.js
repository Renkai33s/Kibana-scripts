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

  // ---------- УТИЛИТЫ: форматирование ТОЛЬКО body, сохраняя всё остальное ----------

  // Пытаемся гибко распарсить JSON в body (учитываем вариант "строка с экранированным JSON")
  function parseJsonFlexible(raw){
    let s = raw.trim();
    // Если значение в кавычках — попробуем сначала распаковать в строку
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))){
      try { s = JSON.parse(s); } catch { s = s.slice(1,-1); }
    }
    const t = s.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        return { ok:true, value: JSON.parse(t) };
      } catch {}
    }
    return { ok:false, value: s };
  }

  // Основной проход по тексту: ищем все body на верхнем уровне, меняем И ТОЛЬКО их.
  function replaceAllBodiesPreservingText(str){
    let i = 0, depth = 0, inQ = null;
    let out = '', last = 0;
    const n = str.length;

    function isWordChar(c){ return /[A-Za-z0-9_]/.test(c); }

    while(i < n){
      const ch = str[i];
      const prev = str[i-1];

      // режим кавычек
      if(inQ){
        if(ch === inQ && prev !== '\\') inQ = null;
        i++; continue;
      }
      if(ch === '"' || ch === "'"){ inQ = ch; i++; continue; }

      // баланс скобок
      if(ch === '{' || ch === '[' || ch === '('){ depth++; i++; continue; }
      if(ch === '}' || ch === ']' || ch === ')'){ depth = Math.max(0, depth-1); i++; continue; }

      // На верхнем уровне ищем ключ body (без учёта регистра), за которым идёт = или :
      if (depth === 0 && (ch === 'b' || ch === 'B')){
        const lower = str.slice(i, i+4).toLowerCase();
        if (lower === 'body'){
          const prevCh = str[i-1];
          if (i === 0 || !isWordChar(prevCh)){ // граница слова
            // идём к разделителю
            let j = i + 4;
            while(j < n && /\s/.test(str[j])) j++;
            if (j < n && (str[j] === '=' || str[j] === ':')){
              j++;
              while(j < n && /\s/.test(str[j])) j++;
              if (j >= n) break;

              const valStart = j;
              let k = j;

              // Считываем значение body: строка, JSON-объект/массив, либо "простое" до запятой/перевода строки
              if (str[k] === '"' || str[k] === "'"){
                const quote = str[k]; k++;
                while(k < n){
                  const c = str[k], p = str[k-1];
                  if(c === quote && p !== '\\'){ k++; break; }
                  k++;
                }
              } else if (str[k] === '{' || str[k] === '[' || str[k] === '('){
                let innerDepth = 1, innerQ = null; k++;
                while(k < n && innerDepth > 0){
                  const c = str[k], p = str[k-1];
                  if(innerQ){
                    if(c === innerQ && p !== '\\'){ innerQ = null; }
                    k++; continue;
                  }
                  if(c === '"' || c === "'"){ innerQ = c; k++; continue; }
                  if(c === '{' || c === '[' || c === '(') innerDepth++;
                  else if(c === '}' || c === ']' || c === ')') innerDepth--;
                  k++;
                }
              } else {
                while(k < n && str[k] !== ',' && str[k] !== '\n') k++;
              }

              const valEnd = k;
              // Проверяем запятую после значения на верхнем уровне — возвращаем обратно, чтобы не сломать формат
              let t = valEnd;
              while(t < n && /\s/.test(str[t])) t++;
              const hasComma = (t < n && str[t] === ',');
              const endWithComma = hasComma ? t + 1 : t;

              const rawVal = str.slice(valStart, valEnd);
              // Индент берём как лидирующие пробелы текущей строки
              const lineStart = str.lastIndexOf('\n', i-1) + 1;
              const leading = str.slice(lineStart, i).match(/^\s*/)?.[0] ?? '';
              const baseIndent = leading + '  ';

              // Строим замену
              const parsed = parseJsonFlexible(rawVal);
              let replacement;
              if(parsed.ok){
                const pretty = JSON.stringify(parsed.value, null, 2)
                  .split('\n')
                  .map(l => baseIndent + l)
                  .join('\n');
                replacement = 'body:\n' + pretty;
              } else {
                // не JSON — оставляем в одну строку
                replacement = 'body: ' + rawVal.trim();
              }
              if(hasComma) replacement += ',';

              // Собираем результат: всё до ключа + наша замена + дальше
              out += str.slice(last, i) + replacement;
              last = endWithComma;
              i = endWithComma;
              continue;
            }
          }
        }
      }

      i++;
    }

    if (last === 0) return null; // ничего не меняли
    return out + str.slice(last);
  }

  // ---------- ОСНОВНАЯ ЛОГИКА ----------
  try{
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0 || !sel.toString().trim()){ showError("Логи не выделены"); return; }

    const selectedText = sel.toString(); // ВАЖНО: не трогаем пробелы/переносы вообще

    // 1) Попытка точечно заменить ТОЛЬКО body в «сыром» тексте, сохранив всё остальное 1:1
    const rewritten = replaceAllBodiesPreservingText(selectedText);
    if(rewritten){
      navigator.clipboard.writeText(rewritten)
        .then(()=>showSuccess("Скопировано: body отформатирован, остальное без изменений"))
        .catch(()=>showError("Ошибка при копировании"));
      return;
    }

    // 2) Если это таблица — прежняя логика сборки строк + точечное форматирование body внутри payload
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
          const fmt = replaceAllBodiesPreservingText(payload);
          if(fmt) payload = fmt; // подменяем только body, остальное не трогаем
        }

        const parts = [time, message, exception, payload].filter(Boolean);
        const line = parts.join('  ');
        if(line) out.push(line);
      }
    });

    if(out.length===0){ showError("Не нашёл body для форматирования"); return; }

    navigator.clipboard.writeText(out.join('\n'))
      .then(()=>showSuccess("Логи скопированы (body форматирован точечно)"))
      .catch(()=>showError("Ошибка при копировании"));
  } catch(e){
    console.error(e);
    showError("Что-то пошло не так");
  }
})();
