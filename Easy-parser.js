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

  // --- Pretty Print функции ---
  function tryPrettyPrint(str){
    if(!str) return str;

    str = str.trim();

    // 1. JSON
    try {
      const obj = JSON.parse(str);
      return JSON.stringify(obj, null, 2);
    } catch(e){}

    // 2. URL-encoded
    try {
      const decoded = decodeURIComponent(str);
      if(decoded !== str) return decoded;
    } catch(e){}

    // 3. XML (простейшее форматирование)
    if(str.startsWith('<') && str.endsWith('>')){
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(str, 'application/xml');
        const serializer = new XMLSerializer();
        const xmlStr = serializer.serializeToString(xmlDoc);
        // простой pretty print с отступами
        return xmlStr.replace(/(>)(<)(\/*)/g, '$1\n$2$3');
      } catch(e){}
    }

    return str; // если ни одно не сработало
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
            if(td && td.textContent.trim() && !noiseRe.test(td.textContent.trim()) && sel.containsNode(td,true))
              return td.textContent.trim();
          }
          return null;
        }

        const time = getCellText('time');
        const message = tryPrettyPrint(getCellText('message.message'));
        let exception = tryPrettyPrint(getCellText('message.exception'));
        if(exception) exception = exception.split('\n')[0]; // только первая строка
        const payload = tryPrettyPrint(getCellText('payload'));

        // Формат с разделителем "|": time | message | exception | payload
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
