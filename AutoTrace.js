(function(){

  // --- Контейнер уведомлений ---
  // --- Контейнер для уведомлений ---
  let notifContainer = document.getElementById("notif-container");
  if (!notifContainer) {
    notifContainer = document.createElement("div");
    notifContainer.id = "notif-container";
    notifContainer.style.position = "fixed";
    notifContainer.style.bottom = "20px";
    notifContainer.style.right = "20px";
    notifContainer.style.width = "auto";
    notifContainer.style.height = "0"; // сами уведомления позиционируются абсолютно
    notifContainer.style.display = "flex";
    notifContainer.style.flexDirection = "column";
    notifContainer.style.gap = "10px";
    notifContainer.style.zIndex = 999999;
    document.body.appendChild(notifContainer);
  }

  // --- Появление уведомления ---
  // --- Анимированное сообщение ---
  function showMessage(msg, isError = false, isSuccess = false) {
    const div = document.createElement("div");
    div.textContent = msg;
@@ -27,39 +28,26 @@
    div.style.opacity = "0";
    div.style.transform = "translateY(20px)";
    div.style.transition = "all 0.3s ease";
    div.style.position = "absolute";
    div.style.right = "0";

    // вычисляем bottom по существующим уведомлениям
    const offset = Array.from(notifContainer.children)
                        .reduce((acc, el) => acc + el.offsetHeight + 10, 0);
    div.style.bottom = offset + "px";

    notifContainer.appendChild(div);

    requestAnimationFrame(()=>{
    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    });

    // скрытие через 2 сек
    setTimeout(()=>{
    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(20px)";
      setTimeout(()=>div.remove(), 300);
      setTimeout(() => div.remove(), 300);
    }, 2000);
  }
  function showError(msg){ showMessage(msg, true, false); }
  function showSuccess(msg){ showMessage(msg, false, true); }

  // --- XPath helper ---
  function x(p){
    return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
  }
  function parseIntSafe(text){
    const digits = (text || '').replace(/[^\d]/g,'');
    return digits ? Number(digits) : null;
  }

  // --- Основные элементы ---
  const s=x('/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div'); 
@@ -71,8 +59,7 @@
  const bXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[3]/div/div/div/div/div[2]/span/button';

  const cntEl=x(countXPath);
  const cntParsed = cntEl ? parseIntSafe(cntEl.textContent) : null;
  const shouldScroll = (cntParsed === null) ? true : (cntParsed > 50);
  let cnt=cntEl?parseInt(cntEl.textContent.trim(),10):0;

  const table=x(tXPath);
  if(!table){ showError('Таблица не найдена'); return; }
@@ -81,8 +68,6 @@
  if(traceIdx===-1){ showError('Трейсы не найдены'); return; }

  // --- Прогресс ---
  let prog=null, step=0, prevRows=0, unchanged=0, timerID=null;

  function showProgress(){
    const wrap=document.createElement('div');
    wrap.style.position='fixed';
@@ -98,6 +83,7 @@
    wrap.style.display='flex';
    wrap.style.alignItems='center';
    wrap.style.gap='8px';
    wrap.style.transition='opacity 0.3s ease';

    const label=document.createElement('div');
    label.textContent='0 скроллов';
@@ -117,21 +103,30 @@
    document.body.appendChild(wrap);

    return {
      update:(step)=>{ label.textContent = step + ' скроллов'; },
      remove:()=>{ wrap.remove(); },
      update:function(step){label.textContent=step+' скроллов';},
      remove:function(){ wrap.style.opacity='0'; setTimeout(()=>wrap.remove(),300); },
      stopButton:btn
    }
  }

  // --- Переменные скролла ---
  let prog=null, step=0, prevRows=0, unchanged=0, timerID=null;

  function getRowCount(){
    try{
      const table=x(tXPath);
      if(!table)return 0;
      return table.querySelectorAll('tbody tr').length;
    }catch(e){ showError('Ошибка при подсчёте строк'); return 0; }
    }catch(e){
      showError('Ошибка при подсчёте строк');
      return 0;
    }
  }

  function runAfterScroll(){
    try{
      let ids=[];
      const table=x(tXPath);
      table.querySelectorAll('tbody tr').forEach(tr=>{
        const v=tr.children[traceIdx]?.innerText.trim();
        if(v && v!=="-") ids.push(v);
@@ -146,41 +141,50 @@
        ta.dispatchEvent(new Event("input",{bubbles:true}));
        ta.dispatchEvent(new Event("change",{bubbles:true}));
      }

      const b=x(bXPath);
      if(b) b.click();

      if(prog) prog.remove();
      s.scrollTop=0;
      showSuccess("Трейсы подставлены");
    }catch(e){ showError('Что-то пошло не так'); }
    }catch(e){
      if(prog) prog.remove();
      showError('Что-то пошло не так');
    }
  }

  function scrollLoop(){
    s.scrollTop = s.scrollHeight;
    step++;
    if(prog) prog.update(step);

    timerID=setTimeout(()=>{
      const rows=getRowCount();
      if(rows>prevRows){ prevRows=rows; unchanged=0; }
      else unchanged++;

      if(unchanged < 10){
        scrollLoop();
      } else {
        runAfterScroll();
      }
    },100);
    if(!s) return;
    try{
      s.scrollTop=s.scrollHeight;
      step++;
      if(prog) prog.update(step);

      timerID=setTimeout(()=>{
        const rows=getRowCount();
        if(rows>prevRows){prevRows=rows;unchanged=0;}
        else unchanged++;

        if(unchanged<10){
          scrollLoop();
        }else{
          runAfterScroll();
        }
      },100);
    }catch(e){
      showError('Ошибка при скролле');
      runAfterScroll();
    }
  }

  // --- Запуск ---
  if(!shouldScroll){
  if(isNaN(cnt)||cnt<=50){
    runAfterScroll();
  } else {
  }else{
    prog = showProgress();
    prog.stopButton.onclick = ()=>{
      if(timerID) clearTimeout(timerID);
      runAfterScroll(); // мгновенно
      runAfterScroll(); // сразу, без задержки
    };
    scrollLoop();
  }
