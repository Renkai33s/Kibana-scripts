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

  // --- Форматирование вложенных структур {…} и […] ---
  function formatNestedObject(str, indent = 0) {
    if(!str) return str;
    const spaces = '  '.repeat(indent);

    return str.replace(/([{\[])([\s\S]*?)([}\]])/g, (match, open, inner, close) => {
      let depth = 0;
      const parts = [];
      let current = '';
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === '{' || ch === '[') depth++;
        if (ch === '}' || ch === ']') depth--;
        if (ch === ',' && depth === 0) {
          parts.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      if (current.trim()) parts.push(current.trim());

      const isSingle = parts.length === 1 && !/[{\[]/.test(parts[0]);

      if (isSingle) {
        return open + parts[0].trim() + close;
      }

      const formattedInner = parts.map(p => {
        return spaces + '  ' + formatNestedObject(p, indent + 1);
      }).join(',\n');

      return open + '\n' + formattedInner + '\n' + spaces + close;
    });
  }

  // --- Форматирование XML ---
  function formatXML(xml) {
    if(!xml) return xml;
    let formatted = '';
    let indent = 0;
    const reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\n$2$3');
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

              // форматирование вложенных {…} или […]
              if(/[{\[]/.test(val)) {
                val = formatNestedObject(val, 0);
              }

              // форматирование XML
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
