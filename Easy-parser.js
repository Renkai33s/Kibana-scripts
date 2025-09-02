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

  function showError(msg){ showMessage(msg,true,false); }
  function showSuccess(msg){ showMessage(msg,false,true); }

  // --- Утилита: разделение верхнего уровня по запятым (учитывает кавычки и вложенности) ---
  function splitTopLevel(str) {
    const parts = [];
    let curr = '';
    let depth = 0;
    let inString = false;
    let prev = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"' && prev !== '\\') {
        inString = !inString;
        curr += ch;
        prev = ch;
        continue;
      }
      if (!inString) {
        if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') depth--;
        if (ch === ',' && depth === 0) {
          parts.push(curr);
          curr = '';
          prev = ch;
          continue;
        }
      }
      curr += ch;
      prev = ch;
    }
    if (curr.length > 0) parts.push(curr);
    // trim each part
    return parts.map(p => p.trim()).filter(p => !(p === '' && parts.length === 1 && str.trim() === ''));
  }

  // --- Форматирование вложенных структур {…} и […] (парсерный вариант) ---
  function formatNestedObject(str, indent = 0) {
    if (!str) return str;
    const spaces = '  '.repeat(indent);
    let out = '';
    let i = 0;

    while (i < str.length) {
      const ch = str[i];

      if (ch === '{' || ch === '[') {
        const open = ch;
        const close = (ch === '{') ? '}' : ']';
        // найти соответствующую закрывающую скобку, учитывая строки в кавычках
        let j = i + 1;
        let depth = 1;
        let inString = false;
        let prev = '';
        while (j < str.length && depth > 0) {
          const c = str[j];
          if (c === '"' && prev !== '\\') inString = !inString;
          if (!inString) {
            if (c === open) depth++;
            else if (c === close) depth--;
          }
          prev = c;
          j++;
        }
        // если не нашли закрывающую, просто добавим оставшуюся часть и выйдем
        if (depth !== 0) {
          out += str.slice(i);
          break;
        }

        const inner = str.slice(i + 1, j - 1);
        // пустой блок -> "[]" или "{}"
        if (inner.trim() === '') {
          out += open + close;
          i = j;
          continue;
        }

        const parts = splitTopLevel(inner);

        // если ровно один топ-уровневый элемент и он не содержит вложенных скобок -> оставить в строчку
        const isSingleSimple = parts.length === 1 && !/[{\[]/.test(parts[0]) && !parts[0].includes('\n');

        if (isSingleSimple) {
          out += open + parts[0].trim() + close;
        } else {
          out += open + '\n';
          for (let k = 0; k < parts.length; k++) {
            const p = parts[k];
            // добавляем отступ + рекурсивное форматирование части
            out += spaces + '  ' + formatNestedObject(p, indent + 1);
            if (k < parts.length - 1) out += ',\n';
            else out += '\n';
          }
          out += spaces + close;
        }

        i = j;
      } else {
        out += ch;
        i++;
      }
    }

    return out;
  }

  // --- Форматирование XML (без отрицательного indent) ---
  function formatXML(xml) {
    if(!xml) return xml;
    let formatted = '';
    let indent = 0;
    const reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\n$2$3'); // вставляем переносы между тегами
    const lines = xml.split('\n');
    lines.forEach(line => {
      if(line.match(/^<\/\w/)) indent--;
      const safeIndent = Math.max(indent, 0);
      formatted += '  '.repeat(safeIndent) + line + '\n';
      if(line.match(/^<[^\/!?][^>]*[^\/]>$/)) indent++;
    });
    return formatted.trim();
  }

  // --- Основная логика ---
  try{
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0 || !sel.toString().trim()){ showError("Логи не выделены"); return; }

    const noiseRe = /^(INFO|DEBUG|WARN|WARNING|ERROR|TRACE|-|–|—)$/i;
    const trs = Array.from(document.querySelectorAll('tr'));
    const out = [];

    trs.forEach(tr=>{
      const cells = Array.from(tr.querySelectorAll('td,th'));
      const selected = cells.filter(td=>sel.containsNode(td,true));
      if(selected.length>0){
        const table = tr.closest('table');
        const headerRow = table.querySelector('thead tr') || Array.from(table.querySelectorAll('tr')).find(rw=>rw.querySelectorAll('th').length>0) || table.querySelector('tr');
        const ths = Array.from(headerRow.querySelectorAll('th,td'));

        function getCellText(key){
          const idx = ths.findIndex(th=>th.textContent.trim().toLowerCase()===key);
          if(idx>=0){
            const td = cells[idx];
            if(td && td.textContent.trim() && !noiseRe.test(td.textContent.trim()) && sel.containsNode(td,true)) {
              let val = td.textContent.trim();

              // форматирование exception: только первая строка
              if(key === 'message.exception'){
                val = val.split('\n')[0];
              }

              // сначала форматируем вложенные {…} или […] — парсером
              if(/[{\[]/.test(val)) {
                val = formatNestedObject(val, 0);
              }

              // затем форматируем XML, если есть
              if(/<[^>]+>/.test(val)) {
                val = formatXML(val);
              }

              return val;
            }
          }
          return null;
        }

        const time = getCellText('time');
        const message = getCellText('message.message');
        const exception = getCellText('message.exception');
        const payload = getCellText('payload');

        const block = [time, message, exception, payload].filter(Boolean).join(' | ');
        if(block) out.push(block);
      }
    });

    if(out.length===0){ showError("Нет полезных логов для копирования"); return; }

    navigator.clipboard.writeText(out.join('\n'))
      .then(()=>showSuccess("Логи скопированы"))
      .catch(()=>showError("Ошибка при копировании"));

  } catch(e){
    console.error(e);
    showError("Что-то пошло не так");
  }
})();
