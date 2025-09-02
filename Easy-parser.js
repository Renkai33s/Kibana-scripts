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

  // --- Pretty Print JSON ---
  function prettyPrintJSON(str){
    try { return JSON.stringify(JSON.parse(str), null, 2); }
    catch(e){ return str; }
  }

  // --- Pretty Print XML (встроенный мини вариант) ---
  function prettyPrintXML(xml){
    let formatted = '';
    const reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\r\n$2$3');
    let pad = 0;
    xml.split('\r\n').forEach(node=>{
      let indent = '';
      if(node.match(/.+<\/\w[^>]*>$/)) indent = '  '.repeat(pad);
      else if(node.match(/^<\/\w/)) { pad = Math.max(pad-1,0); indent = '  '.repeat(pad); }
      else if(node.match(/^<\w([^>]*[^\/])?>.*$/)) { indent = '  '.repeat(pad); pad++; }
      else indent = '  '.repeat(pad);
      formatted += indent + node + '\n';
    });
    return formatted;
  }

  // --- Основная логика ---
  try{
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0 || !sel.toString().trim()){ showError("Логи не выделены"); return; }

    const text = sel.toString();
    const lines = text.split(/\r?\n/);
    const out = [];

    let currentLog = {time:'', message:'', exception:'', payload:''};
    let bufferPayload = '';

    lines.forEach(line=>{
      line = line.trim();
      if(!line) return;

      // Определяем поля по признакам (даты, INFO/WARN/ERROR и т.д.)
      if(line.match(/^\w{3} \d{1,2}, \d{4} @ \d{2}:\d{2}:\d{2}/)) {
        // Новый лог
        if(currentLog.time) {
          // Сохраняем предыдущий
          if(bufferPayload){
            // pretty print JSON/XML если возможно
            if(bufferPayload.startsWith('{') && bufferPayload.endsWith('}')){
              currentLog.payload = prettyPrintJSON(bufferPayload);
            } else if(bufferPayload.startsWith('<') && bufferPayload.endsWith('>')){
              currentLog.payload = prettyPrintXML(bufferPayload);
            } else {
              currentLog.payload = bufferPayload;
            }
            bufferPayload = '';
          }
          out.push([currentLog.time, currentLog.message, currentLog.exception, currentLog.payload].filter(Boolean).join(' | '));
          currentLog = {time:'', message:'', exception:'', payload:''};
        }
        currentLog.time = line;
      }
      else if(line.startsWith('INFO') || line.startsWith('DEBUG') || line.startsWith('WARN') || line.startsWith('ERROR')) {
        currentLog.message = line;
      }
      else if(line.startsWith('request:') || line.startsWith('SOAP-OUT') || line.startsWith('response:')) {
        bufferPayload += line + '\n';
      }
      else if(line.startsWith('-')) {
        // игнорируем разделители
      }
      else {
        // Считаем как exception или дополнительное сообщение
        if(!currentLog.exception) currentLog.exception = line.split('\n')[0]; // только первая строка
        else bufferPayload += line + '\n';
      }
    });

    // Сохраняем последний лог
    if(currentLog.time) {
      if(bufferPayload){
        if(bufferPayload.startsWith('{') && bufferPayload.endsWith('}')){
          currentLog.payload = prettyPrintJSON(bufferPayload);
        } else if(bufferPayload.startsWith('<') && bufferPayload.endsWith('>')){
          currentLog.payload = prettyPrintXML(bufferPayload);
        } else {
          currentLog.payload = bufferPayload;
        }
      }
      out.push([currentLog.time, currentLog.message, currentLog.exception, currentLog.payload].filter(Boolean).join(' | '));
    }

    if(out.length===0){ showError("Нет полезных логов для копирования"); return; }

    navigator.clipboard.writeText(out.join('\n'))
      .then(()=>showSuccess("Логи скопированы с форматированием"))
      .catch(()=>showError("Ошибка при копировании"));

  } catch(e){
    console.error(e);
    showError("Что-то пошло не так");
  }

})();
