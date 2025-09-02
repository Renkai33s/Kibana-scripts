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

  // --- Форматирование JSON / {...} / [...] с сохранением одиночных элементов ---
  function formatNestedObject(str, indent = 0) {
    if (!str) return str;
    const spaces = '  '.repeat(indent);
    let out = '', i = 0;

    function splitTopLevel(s) {
      const parts = [];
      let curr = '', depth = 0, inString = false, prev = '';
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '"' && prev !== '\\') inString = !inString;
        if (!inString) {
          if (ch === '{' || ch === '[') depth++;
          if (ch === '}' || ch === ']') depth--;
          if (ch === ',' && depth === 0) { parts.push(curr); curr = ''; prev = ch; continue; }
        }
        curr += ch;
        prev = ch;
      }
      if (curr) parts.push(curr);
      return parts.map(p => p.trim()).filter(Boolean);
    }

    while (i < str.length) {
      const ch = str[i];
      if (ch === '{' || ch === '[') {
        const open = ch, close = ch === '{' ? '}' : ']';
        let j = i+1, depth=1, inString=false, prev='';
        while (j<str.length && depth>0) {
          const c = str[j];
          if (c === '"' && prev !== '\\') inString = !inString;
          if (!inString) { if(c===open) depth++; else if(c===close) depth--; }
          prev=c; j++;
        }
        if (depth!==0) { out+=str.slice(i); break; }
        const inner=str.slice(i+1,j-1);
        if(!inner.trim()){ out+=open+close; i=j; continue; }

        const parts = splitTopLevel(inner);
        const isSingleSimple = parts.length===1 && !/[{\[]/.test(parts[0]) && !parts[0].includes('\n');
        if (isSingleSimple) out+=open+parts[0]+close;
        else {
          out+=open+'\n';
          for (let k=0;k<parts.length;k++){
            out+=spaces+'  '+formatNestedObject(parts[k], indent+1);
            if(k<parts.length-1) out+=',\n'; else out+='\n';
          }
          out+=spaces+close;
        }
        i=j;
      } else { out+=ch; i++; }
    }
    return out;
  }

  // --- Универсальная обработка body / payload ---
  function formatBody(text) {
    if(!text) return "";

    text=text.trim();

    if(/^\s*[\{\[]/.test(text)){
      try{
        const parsed=JSON.parse(text);
        return formatNestedObject(JSON.stringify(parsed));
      } catch { return text; }
    }

    if(/<[a-zA-Z]/.test(text) && />/.test(text)) return formatXML(text);

    if(text.includes("=") && text.includes("&")){
      const parts=text.split("&");
      if(parts.length===1) return `{${decodeURIComponent(parts[0])}}`;
      return "{\n  "+parts.map(p=>{
        const [k,v]=p.split("=");
        return `${decodeURIComponent(k)}=${decodeURIComponent(v??"")}`;
      }).join(",\n  ")+"\n}";
    }

    return text;
  }

  // --- Форматирование XML с учётом одиночных тегов ---
  function formatXML(xml){
    try{
      const reg=/(>)(<)(\/*)/g;
      let pad=0;
      return xml.replace(reg,"$1\n$2$3")
        .split("\n")
        .map(line=>{
          line=line.trim();
          if(!line) return '';
          let indent=0;
          if(/^<\w[^>]*>.*<\/\w/.test(line)) indent=0;
          else if(/^<\/\w/.test(line)) { pad--; indent=0; }
          else if(/^<\w[^>]*[^\/]>/.test(line)) indent=1;
          const res="  ".repeat(Math.max(pad,0))+line;
          pad+=indent;
          return res;
        })
        .filter(Boolean)
        .join("\n");
    } catch { return xml; }
  }

  // --- Основная логика ---
  try{
    const sel=window.getSelection();
    if(!sel || sel.rangeCount===0 || !sel.toString().trim()){ showError("Логи не выделены"); return; }

    const noiseRe=/^(INFO|DEBUG|WARN|WARNING|ERROR|TRACE|-|–|—)$/i;
    const trs=Array.from(document.querySelectorAll('tr'));
    const out=[];

    trs.forEach(tr=>{
      const cells=Array.from(tr.querySelectorAll('td,th'));
      const selected=cells.filter(td=>sel.containsNode(td,true));
      if(selected.length>0){
        const table=tr.closest('table');
        const headerRow=table.querySelector('thead tr') || Array.from(table.querySelectorAll('tr')).find(rw=>rw.querySelectorAll('th').length>0) || table.querySelector('tr');
        const ths=Array.from(headerRow.querySelectorAll('th,td'));

        function getCellText(key){
          const idx=ths.findIndex(th=>th.textContent.trim().toLowerCase()===key);
          if(idx>=0){
            const td=cells[idx];
            if(td && td.textContent.trim() && !noiseRe.test(td.textContent.trim()) && sel.containsNode(td,true)){
              let val=td.textContent.trim();
              if(key==="message.exception") val=val.split("\n")[0];
              if(["payload","body"].includes(key)) val=formatBody(val);
              return val;
            }
          }
          return null;
        }

        const time=getCellText('time');
        const message=getCellText('message.message');
        const exception=getCellText('message.exception');
        const payload=getCellText('payload');
        const body=getCellText('body');

        const parts=[time,message,exception,payload,body].filter(Boolean);
        if(parts.length>0) out.push(parts.join("  "));
      }
    });

    if(out.length===0){ showError("Нет полезных логов для копирования"); return; }

    navigator.clipboard.writeText(out.join("\n"))
      .then(()=>showSuccess("Логи скопированы"))
      .catch(()=>showError("Ошибка при копировании"));

  } catch(e){
    console.error(e);
    showError("Что-то пошло не так");
  }
})();
