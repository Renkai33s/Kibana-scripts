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

  function prettyPrintJSON(str){
    try { return JSON.stringify(JSON.parse(str), null, 2); }
    catch(e) { return str; } // если не JSON — возвращаем как есть
  }

  function prettyPrintXML(str){
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(str, "application/xml");
      const serializer = new XMLSerializer();
      return vkbeautify.xml(serializer.serializeToString(xmlDoc)); // используем vkbeautify для отступов
    } catch(e) { return str; }
  }

  // Вставляем vkbeautify в скрипт
  function loadVkBeautify(callback){
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/vkbeautify/0.99.00/vkbeautify.js';
    s.onload = callback;
    document.head.appendChild(s);
  }

  loadVkBeautify(()=>{
    try{
      const sel = window.getSelection();
      if(!sel || sel.rangeCount===0 || !sel.toString().trim()){ showError("Логи не выделены"); return; }

      const text = sel.toString();
      const lines = text.split(/\r?\n/).filter(Boolean);

      const out = [];

      let buffer = '';
      lines.forEach(line=>{
        line = line.trim();
        // Пытаемся распарсить как JSON
        if(line.startsWith('{') && line.endsWith('}')){
          buffer += prettyPrintJSON(line) + '\n';
        }
        // Пытаемся распарсить как XML
        else if(line.startsWith('<') && line.endsWith('>')){
          buffer += prettyPrintXML(line) + '\n';
        } else {
          buffer += line + '\n';
        }
      });

      navigator.clipboard.writeText(buffer.trim())
        .then(()=>showSuccess("Логи скопированы с форматированием"))
        .catch(()=>showError("Ошибка при копировании"));

    } catch(e){
      console.error(e);
      showError("Что-то пошло не так");
    }
  });
})();
