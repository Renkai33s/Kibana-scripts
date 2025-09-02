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

  // --- Pretty print in-place ---
  function prettyPrintInPlace(str){
    if(!str) return str;

    // --- JSON / URL-encoded ---
    str = str.replace(/body=({.*?}|\[.*?\])/gs, (match, p1)=>{
      try { return 'body=' + JSON.stringify(JSON.parse(p1), null, 2); } catch { return match; }
    });

    str = str.replace(/body=([^\s]+)/g, (match, p1)=>{
      if(p1.includes('=') && p1.includes('&')){
        try {
          const params = new URLSearchParams(p1);
          const formatted = [...params].map(([k,v])=>`${k}: ${v}`).join('\n');
          return 'body=' + formatted;
        } catch { return match; }
      }
      return match;
    });

    // --- SOAP/XML messages ---
    str = str.replace(/SOAP-(?:OUT|IN) message:\s*(<.+>)/gs, (match, p1)=>{
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(p1, "application/xml");
        const serializer = new XMLSerializer();
        // Добавляем переносы и отступы вручную
        const pretty = vkbeautify.xml(serializer.serializeToString(xmlDoc));
        return match.replace(p1, pretty);
      } catch { return match; }
    });

    return str;
  }

  // --- Основная логика ---
  try{
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0 || !sel.toString().trim()){ showError("Логи не выделены"); return; }

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
            if(td && td.textContent.trim() && sel.containsNode(td,true))
              return td.textContent.trim();
          }
          return null;
        }

        const time = getCellText('time');
        let message = getCellText('message.message');
        let exception = getCellText('message.exception');
        if(exception) exception = exception.split('\n')[0];
        let payload = getCellText('payload');

        message = prettyPrintInPlace(message);
        payload = prettyPrintInPlace(payload);

        const line = [time, message, exception, payload].filter(Boolean).join(' | ');
        if(line) out.push(line);
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
