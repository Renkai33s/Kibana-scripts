(function(){
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

  // --- Разбивает строку на верхнеуровневые пары по запятым, учитывая {…}, […], кавычки ---
  function splitTopLevel(str) {
    const parts = [];
    let curr = '';
    let depth = 0;
    let inString = false;
    let prev = '';
    for(let i=0;i<str.length;i++){
      const ch = str[i];
      if(ch === '"' && prev !== '\\'){ inString = !inString; curr += ch; prev=ch; continue; }
      if(!inString){
        if(ch==='{' || ch==='[') depth++;
        else if(ch==='}' || ch===']') depth--;
        if(ch===',' && depth===0){ parts.push(curr); curr=''; prev=ch; continue; }
      }
      curr += ch;
      prev = ch;
    }
    if(curr) parts.push(curr);
    return parts.map(p=>p.trim()).filter(Boolean);
  }

  function formatNestedObject(str, indent=0){
    if(!str) return str;
    const spaces = '  '.repeat(indent);
    // key=[…] отдельно
    const m = str.match(/^([^=]+)=\[(.*)\]$/);
    if(m){
      const key = m[1];
      const inner = m[2];
      const formattedInner = formatNestedObject('['+inner+']', indent+1);
      return spaces + key + '=' + formattedInner;
    }
    if(str[0]==='{' || str[0]==='['){
      const open = str[0], close = (open==='{'?'}':']');
      let inner = str.slice(1,-1);
      const parts = splitTopLevel(inner);
      if(parts.length===0) return open+close;
      let out = open + '\n';
      parts.forEach((p,i)=>{
        out += formatNestedObject(p, indent+1);
        if(i<parts.length-1) out += ',\n';
        else out += '\n';
      });
      out += spaces + close;
      return out;
    }
    return spaces + str;
  }

  function formatURLEncoded(str, indent=0){
    if(!str) return str;
    const spaces = '  '.repeat(indent);
    const pairs = str.split('&').map(p=>{
      const [k,v] = p.split('=');
      try { return k+'='+decodeURIComponent(v||''); } catch { return p; }
    });
    if(pairs.length===1) return spaces + '{ '+pairs[0]+' }';
    return spaces + '{\n' + pairs.map(p=>spaces+'  '+p).join(',\n') + '\n'+spaces+'}';
  }

  function formatXML(xml){
    if(!xml) return xml;
    let formatted='';
    let indent=0;
    const reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg,'$1\n$2$3');
    xml.split('\n').forEach(line=>{
      if(line.match(/^<\/\w/)) indent--;
      const safeIndent = Math.max(indent,0);
      formatted += '  '.repeat(safeIndent)+line+'\n';
      if(line.match(/^<[^\/!?][^>]*[^\/]>$/)) indent++;
    });
    return formatted.trim();
  }

  // --- Разбор строки запроса на пары key=value верхнего уровня ---
  function parseTopLevelPairs(str){
    const pairs = splitTopLevel(str);
    const obj = {};
    pairs.forEach(p=>{
      const idx = p.indexOf('=');
      if(idx>0){
        const key = p.slice(0,idx).trim();
        const val = p.slice(idx+1).trim();
        obj[key] = val;
      } else obj[p.trim()] = '';
    });
    return obj;
  }

  try{
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0 || !sel.toString().trim()){ showError("Логи не выделены"); return; }

    const trs = Array.from(document.querySelectorAll('tr'));
    const out=[];

    trs.forEach(tr=>{
      const cells = Array.from(tr.querySelectorAll('td,th'));
      const selected = cells.filter(td=>sel.containsNode(td,true));
      if(selected.length===0) return;
      const td = selected[0];
      let val = td.textContent.trim();

      // --- парсим верхнеуровневые пары ---
      const obj = parseTopLevelPairs(val);
      const formattedParts = [];

      Object.keys(obj).forEach(k=>{
        let v = obj[k];
        // exception только первая строка
        if(k.toLowerCase().includes('exception')) v = v.split('\n')[0];
        // URL-encoded
        else if(/^[^=]+=[^=]+/.test(v) && v.includes('&')) v = formatURLEncoded(v,0);
        // XML
        else if(/<[^>]+>/.test(v)) v = formatXML(v);
        // вложенные объекты/массивы и key=[…]
        else if(/[{\[]/.test(v)) v = formatNestedObject(v,0);

        formattedParts.push(k+'='+v);
      });

      out.push(formattedParts.join('  '));
    });

    if(out.length===0){ showError("Нет полезных логов для копирования"); return; }

    navigator.clipboard.writeText(out.join('\n')).then(()=>showSuccess("Логи скопированы")).catch(()=>showError("Ошибка при копировании"));

  }catch(e){
    console.error(e);
    showError("Что-то пошло не так");
  }
})();
