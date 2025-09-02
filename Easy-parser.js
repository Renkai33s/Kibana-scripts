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

  // --- Pretty Print для частичных JSON, XML, URL-encoded ---
  function prettyPartial(str){
    if(!str) return str;

    // --- JSON фрагменты ---
    str = str.replace(/({[\s\S]*?})/g, (match)=>{
      try{
        const obj = JSON.parse(match);
        return JSON.stringify(obj, null, 2);
      } catch(e){ return match; }
    });

    // --- XML фрагменты ---
    str = str.replace(/(<[?\/]?[a-zA-Z][^>]*>[\s\S]*?<\/[a-zA-Z][^>]*>)/g, (match)=>{
      try{
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(match, "application/xml");
        if(!xmlDoc.querySelector("parsererror")){
          const serializer = new XMLSerializer();
          return serializer.serializeToString(xmlDoc).replace(/></g, '>\n<');
        }
      } catch(e){}
      return match;
    });

    // --- URL-encoded ---
    str = str.replace(/([a-zA-Z0-9%]+=[^&\s]+(&[a-zA-Z0-9%]+=[^&\s]+)*)/g, (match)=>{
      try{
        const decoded = decodeURIComponent(match);
        if(decoded !== match){
          return decoded.replace(/&/g, '\n');
        }
      } catch(e){}
      return match;
    });

    return str;
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
        const message = prettyPartial(getCellText('message.message'));
        let exception = getCellText('message.exception');
        if(exception) exception = prettyPartial(exception.split('\n')[0]);
        const payload = prettyPartial(getCellText('payload'));

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
