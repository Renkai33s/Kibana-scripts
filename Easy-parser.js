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

  // --- Форматирование ---
  function formatXML(xml) {
    try {
      const PADDING = "  ";
      const reg = /(>)(<)(\/*)/g;
      let pad = 0;
      return xml.replace(reg, "$1\n$2$3")
        .split("\n")
        .map((node) => {
          let indent = 0;
          if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0;
          } else if (node.match(/^<\/\w/)) {
            if (pad > 0) pad -= 1;
          } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1;
          }
          const line = PADDING.repeat(pad) + node;
          pad += indent;
          return line;
        })
        .join("\n");
    } catch {
      return xml;
    }
  }

  function formatBody(text) {
    if (!text) return "";

    text = text.trim();

    // JSON
    if (/^\s*[\{\[]/.test(text)) {
      try {
        return JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        return text;
      }
    }

    // XML
    if (/<[a-zA-Z]/.test(text) && />/.test(text)) {
      return formatXML(text);
    }

    // form-urlencoded
    if (text.includes("=") && text.includes("&")) {
      return "{\n  " + text
        .split("&")
        .map(p => {
          const [k, v] = p.split("=");
          try {
            return `${decodeURIComponent(k)}=${decodeURIComponent(v ?? "")}`;
          } catch {
            return `${k}=${v ?? ""}`;
          }
        })
        .join(",\n  ") + "\n}";
    }

    return text;
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
            if(td && td.textContent.trim() && !noiseRe.test(td.textContent.trim()) && sel.containsNode(td,true)){
              let val = td.textContent.trim();
              if (key === "message.exception") {
                val = val.split("\n")[0]; // только первая строка
              }
              if (["payload","body"].includes(key)) {
                val = formatBody(val);
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
        const body = getCellText('body');

        const parts = [time, message, exception, payload, body].filter(Boolean);
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
