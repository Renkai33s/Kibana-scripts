(function(){
  // --- Уведомления ---
  if(!window.__notifContainer){
    const c=document.createElement('div');
    c.id='notif-container';
    c.style.position='fixed';
    c.style.bottom='20px';
    c.style.right='20px';
    c.style.width='auto';
    c.style.zIndex=999999;
    document.body.appendChild(c);
    window.__notifContainer=c;
    window.__currentNotif=null;
  }
  function showMessage(msg,isError=false,isSuccess=false){
    if(window.__currentNotif){ window.__currentNotif.remove(); window.__currentNotif=null; }
    const d=document.createElement('div');
    d.textContent=msg;
    d.style.padding='10px 15px';
    d.style.borderRadius='8px';
    d.style.background=isError?'#ff4d4f':isSuccess?'#52c41a':'#3498db';
    d.style.color='white';
    d.style.fontFamily='sans-serif';
    d.style.fontSize='14px';
    d.style.minWidth='120px';
    d.style.textAlign='center';
    d.style.boxShadow='0 2px 6px rgba(0,0,0,0.2)';
    window.__notifContainer.appendChild(d);
    window.__currentNotif=d;
    setTimeout(()=>{ if(window.__currentNotif===d){ d.remove(); window.__currentNotif=null } },2000);
  }
  function showError(msg){ showMessage(msg,true,false); }
  function showSuccess(msg){ showMessage(msg,false,true); }

  // --- Форматирование JSON-подобного текста ---
  function formatJSONText(text, indent=0){
    const spaces='  '.repeat(indent);
    text=text.trim();
    if(!text.startsWith('{') && !text.startsWith('[')) return text;

    let out='',i=0;
    while(i<text.length){
      const ch=text[i];
      if(ch==='{'||ch==='['){
        const open=ch,close=ch==='{'?'}':']';
        let j=i+1,depth=1,inString=false,prev='';
        while(j<text.length && depth>0){
          const c=text[j];
          if(c==='"' && prev!=='\\') inString=!inString;
          if(!inString){ if(c===open) depth++; else if(c===close) depth--; }
          prev=c;j++;
        }
        const inner=text.slice(i+1,j-1);
        const innerParts=splitTopLevel(inner);
        const isSingleSimple=innerParts.length===1 && !/[\{\[]/.test(innerParts[0]);
        if(isSingleSimple) out+=open+innerParts[0]+close;
        else{
          out+=open+'\n';
          for(let k=0;k<innerParts.length;k++){
            out+=spaces+'  '+formatJSONText(innerParts[k],indent+1);
            if(k<innerParts.length-1) out+=',\n'; else out+='\n';
          }
          out+=spaces+close;
        }
        i=j;
      } else { out+=ch; i++; }
    }
    return out;

    function splitTopLevel(s){
      const parts=[],inString=false,prev='',stack=[];
      let curr='',instr=false;
      for(let c,i=0;i<s.length;i++){
        c=s[i];
        if(c==='"' && prev!=='\\') instr=!instr;
        if(!instr){
          if(c==='{'||c==='[') stack.push(c);
          if(c==='}'||c===']') stack.pop();
          if(c===',' && stack.length===0){ parts.push(curr); curr=''; prev=c; continue; }
        }
        curr+=c; prev=c;
      }
      if(curr) parts.push(curr);
      return parts.map(p=>p.trim()).filter(Boolean);
    }
  }

  // --- Форматирование XML ---
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
          else if(/^<\/\w/.test(line)){ pad--; indent=0; }
          else if(/^<\w[^>]*[^\/]>/.test(line)) indent=1;
          const res="  ".repeat(Math.max(pad,0))+line;
          pad+=indent;
          return res;
        })
        .filter(Boolean)
        .join("\n");
    } catch{return xml;}
  }

  // --- Форматирование form-urlencoded ---
  function formatFormUrlEncoded(text){
    const parts=text.split("&");
    if(parts.length===1) return `{${decodeURIComponent(parts[0])}}`;
    return "{\n  "+parts.map(p=>{
      const [k,v]=p.split("=");
      return `${decodeURIComponent(k)}=${decodeURIComponent(v??"")}`;
    }).join(",\n  ")+"\n}";
  }

  // --- Универсальная функция форматирования тела ---
  function formatBody(text){
    if(!text) return "";
    text=text.trim();
    if(text.startsWith('{')||text.startsWith('[')) return formatJSONText(text);
    if(text.includes("=")&&text.includes("&")) return formatFormUrlEncoded(text);
    if(text.includes("<") && text.includes(">")) return formatXML(text);
    return text;
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
              if(["payload","body","message.message"].includes(key)) val=formatBody(val);
              return val;
            }
          }
          return null;
        }

        const keys=['time','message.message','message.exception','payload','body'];
        const parts=keys.map(getCellText).filter(Boolean);
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
