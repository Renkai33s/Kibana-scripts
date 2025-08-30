(function () {
  // --- Контейнер уведомлений ---
  let notifContainer = document.getElementById("notif-container");
  if (!notifContainer) {
    notifContainer = document.createElement("div");
    notifContainer.id = "notif-container";
    notifContainer.style.position = "fixed";
    notifContainer.style.bottom = "20px";
    notifContainer.style.right = "20px";
    notifContainer.style.width = "300px";
    notifContainer.style.height = "auto";
    notifContainer.style.pointerEvents = "none";
    document.body.appendChild(notifContainer);
  }

  // --- Анимированное сообщение ---
  function showMessage(msg, isError=false, isSuccess=false) {
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = isError ? "#ff4d4f" : isSuccess ? "#52c41a" : "#3498db";
    div.style.color = "white";
    div.style.fontFamily = "sans-serif";
    div.style.fontSize = "14px";
    div.style.opacity = "0";
    div.style.transform = "translateY(30px)";
    div.style.transition = "transform 0.3s ease, opacity 0.3s ease";
    div.style.position = "absolute";
    div.style.right = "0";
    div.style.pointerEvents = "auto";

    // сдвигаем существующие уведомления вверх
    const notifs = notifContainer.querySelectorAll("div");
    notifs.forEach(n => {
      const currentY = parseFloat(n.dataset.y || "0");
      const newY = currentY + 40;
      n.dataset.y = newY;
      n.style.transform = `translateY(${newY}px)`;
    });

    div.dataset.y = "0";
    notifContainer.appendChild(div);

    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(-30px)";
      setTimeout(() => div.remove(), 300);
    }, 2000);
  }

  function showError(msg){ showMessage(msg,true,false); }
  function showSuccess(msg){ showMessage(msg,false,true); }

  // --- UI: прогресс ---
  function showProgress() {
    const wrap = document.createElement("div");
    wrap.style.padding = "6px 10px";
    wrap.style.borderRadius = "8px";
    wrap.style.background = "#3498db";
    wrap.style.color = "white";
    wrap.style.fontFamily = "sans-serif";
    wrap.style.fontSize = "14px";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";

    const label = document.createElement("div");
    label.textContent = "0 скроллов";
    wrap.appendChild(label);

    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.padding = "0 4px";
    btn.style.background = "white";
    btn.style.color = "#3498db";
    wrap.appendChild(btn);

    notifContainer.appendChild(wrap);

    return {
      update: step => label.textContent = step + " скроллов",
      remove: () => wrap.remove(),
      stopButton: btn
    };
  }

  function x(p){ return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue; }

  const s = x('/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div');
  if (!s){ showError("Элемент для скролла не найден"); return; }

  const countXPath = '/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[1]/div[1]/div[1]/div[1]/div/div/div[1]/div/strong';
  const tXPath = '/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[2]/div/table';
  const taXPath = '/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[1]/div/div[2]/div/textarea';
  const bXPath = '/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[3]/div/div/div/div/div[2]/span/button';

  const cntEl = x(countXPath);
  let cnt = cntEl ? parseInt(cntEl.textContent.trim(),10) : 0;

  const table = x(tXPath);
  if(!table){ showError("Таблица не найдена"); return; }
  const headers = [...table.querySelectorAll("thead tr th")].map(th=>th.innerText.trim());
  const traceIdx = headers.indexOf("message.traceid");
  if(traceIdx === -1){ showError("Трейсы не найдены"); return; }

  let prog=null, step=0, prevRows=0, unchanged=0, timerID=null, stopRequested=false;

  function getRowCount(){ try{ const table=x(tXPath); if(!table)return 0; return table.querySelectorAll("tbody tr").length;}catch{ showError("Ошибка при подсчёте строк"); return 0;} }

  function runAfterScroll(){
    try{
      let ids=[];
      table.querySelectorAll("tbody tr").forEach(tr=>{
        const v=tr.children[traceIdx]?.innerText.trim();
        if(v && v!=="-") ids.push(v);
      });
      ids=[...new Set(ids)];
      const txt="("+ids.map(v=>'"'+v+'"').join(" ")+")";

      const ta=x(taXPath);
      if(ta){
        const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;
        setter.call(ta,txt);
        ta.dispatchEvent(new Event("input",{bubbles:true}));
        ta.dispatchEvent(new Event("change",{bubbles:true}));
      }

      const b=x(bXPath);
      if(b) b.click();

      if(prog) prog.remove();
      showSuccess("Трейсы подставлены");
      s.scrollTop=0;
    }catch{ showError("Что-то пошло не так"); }
  }

  function scrollLoop(){
    if(!s) return;
    try{
      s.scrollTop=s.scrollHeight;
      step++;
      if(prog) prog.update(step);

      timerID=setTimeout(()=>{
        const rows=getRowCount();
        if(rows>prevRows){ prevRows=rows; unchanged=0;}else{unchanged++;}
        if(unchanged<10 && !stopRequested){ scrollLoop(); } else { runAfterScroll(); }
      },100);
    }catch{ showError("Ошибка при скролле"); runAfterScroll();}
  }

  if(isNaN(cnt)||cnt<=50){ runAfterScroll(); }
  else{
    prog=showProgress();
    prog.stopButton.onclick=()=>{
      stopRequested=true;
      if(timerID) clearTimeout(timerID);
      prog.remove();
      runAfterScroll();
    };
    scrollLoop();
  }
})();
