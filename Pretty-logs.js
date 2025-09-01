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

  // --- Форматирование JSON/XML ---
  function formatTextIfJsonXml(text){
    if(!text) return text;
    text = text.trim();

    // JSON
    if(text.startsWith('{') || text.startsWith('[')){
      try{
        const obj = JSON.parse(text);
        return JSON.stringify(obj, null, 2);
      }catch(e){
        return text;
      }
    }

    // XML / SOAP
    if(text.startsWith('<')){
      try{
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "application/xml");
        if(xmlDoc.getElementsByTagName("parsererror").length){
          return text;
        }
        function formatXml(node, indent = '') {
          let result = '';
          if(node.nodeType === 1){
            result += `${indent}<${node.nodeName}`;
            for(let attr of node.attributes) result += ` ${attr.name}="${attr.value}"`;
            result += '>';
            if(node.childNodes.length > 0){
              result += '\n';
              for(let child of node.childNodes){
                result += formatXml(child, indent + '  ');
              }
              result += `${indent}</${node.nodeName}>\n`;
            } else result += `</${node.nodeName}>\n`;
          } else if(node.nodeType === 3){
            if(node.nodeValue.trim()) result += indent + node.nodeValue.trim() + '\n';
          }
          return result;
        }
        return formatXml(xmlDoc.documentElement).trim();
      }catch(e){
        return text;
      }
    }

    return text;
  }

  // --- Форматирование Java-style объектов ---
  function formatJavaStyleObject(text, indent=''){
    if(!text) return text;
    text = text.trim();

    // Если это JSON/XML, используем старый парсер
    if(text.startsWith('{') || text.startsWith('[') || text.startsWith('<')) {
      return formatTextIfJsonXml(text);
    }

    // Проверка на Java-style object: ClassName{...}
    const match = text.match(/^(\w+)\{(.+)\}$/s);
    if(!match) return text; // не Java-style

    const className = match[1];
    const content = match[2].trim();
    let result = indent + className + ' {\n';

    let buffer = '';
    let depth = 0;
    for(let i=0; i<content.length; i++){
      const char = content[i];
      if(char === '{' || char === '[') depth++;
      if(char === '}' || char === ']') depth--;
      if(char === ',' && depth===0){
        result += formatJavaField(buffer.trim(), indent+'  ');
        buffer = '';
      } else buffer += char;
    }
    if(buffer.trim()) result += formatJavaField(buffer.trim(), indent+'  ');

    result += indent + '}\n';
    return result.trim();
  }

  function formatJavaField(fieldText, indent){
    const idx = fieldText.indexOf('=');
    if(idx<0) return indent + fieldText + '\n';
    const key = fieldText.substring(0, idx).trim();
    let value = fieldText.substring(idx+1).trim();
    // рекурсивно форматируем значение
    if(value.match(/^\w+\{.*\}$/s) || value.startsWith('[')) value = formatJavaStyleObject(value, indent+'  ');
    return `${indent}${key} = ${value}\n`;
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
        const traceid = getCellText('message.traceid');
        const methodid = getCellText('message.methodid');
        const name = getCellText('message.name');
        const message = getCellText('message.message');
        const level = getCellText('message.level');
        const exception = getCellText('message.exception');
        const payload = getCellText('payload');

        const block = [];

        // Первая строка: Time traceid methodid name
        const line1 = [time, traceid, methodid, name].filter(Boolean).join(' ');
        if(line1) block.push(line1);

        if(message) block.push(formatJavaStyleObject(message));
        if(payload) block.push(formatJavaStyleObject(payload));
        if(level) block.push(level);
        if(exception) block.push(exception);

        if(block.length>0) out.push(block.join('\n'));
      }
    });

    if(out.length===0){ showError("Нет полезных логов для копирования"); return; }

    navigator.clipboard.writeText(out.join('\n\n'))
      .then(()=>showSuccess("Логи скопированы"))
      .catch(()=>showError("Ошибка при копировании"));

  } catch(e){
    console.error(e);
    showError("Что-то пошло не так");
  }
})();
