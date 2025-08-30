(function(){

  // --- Контейнер для уведомлений ---
  let notifContainer = document.getElementById("notif-container");
  if (!notifContainer) {
    notifContainer = document.createElement("div");
    notifContainer.id = "notif-container";
    notifContainer.style.position = "fixed";
    notifContainer.style.bottom = "20px";
    notifContainer.style.right = "20px";
    notifContainer.style.display = "flex";
    notifContainer.style.flexDirection = "column";
    notifContainer.style.gap = "10px";
    notifContainer.style.zIndex = 999999;
    document.body.appendChild(notifContainer);
  }

  // --- Анимированное сообщение ---
  function showMessage(msg, isError = false, isSuccess = false) {
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = isError ? "#ff4d4f" : isSuccess ? "#52c41a" : "#3498db";
    div.style.color = "white";
    div.style.fontFamily = "sans-serif";
    div.style.fontSize = "14px";
    div.style.opacity = "0";
    div.style.transform = "translateY(20px)";
    div.style.transition = "all 0.3s ease";

    notifContainer.appendChild(div);
    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(20px)";
      setTimeout(() => div.remove(), 300);
    }, 2000);
  }
  function showError(msg){ showMessage(msg, true, false); }

  // --- Прогресс ---
  function showProgress(){
    const wrap=document.createElement('div');
    wrap.style.padding='6px 10px';
    wrap.style.borderRadius='8px';
    wrap.style.background='#3498db';
    wrap.style.color='white';
    wrap.style.fontFamily='sans-serif';
    wrap.style.fontSize='14px';
    wrap.style.display='flex';
    wrap.style.alignItems='center';
    wrap.style.gap='8px';
    wrap.style.opacity="0";
    wrap.style.transform="translateY(20px)";
    wrap.style.transition="all 0.3s ease";

    const label=document.createElement('div');
    label.textContent='0 скроллов';
    wrap.appendChild(label);

    const btn=document.createElement('button');
    btn.textContent='×';
    btn.style.fontSize='12px';
    btn.style.cursor='pointer';
    btn.style.border='none';
    btn.style.borderRadius='4px';
    btn.style.padding='0 4px';
    btn.style.background='white';
    btn.style.color='#3498db';
    wrap.appendChild(btn);

    notifContainer.appendChild(wrap);
    requestAnimationFrame(()=>{
      wrap.style.opacity="1";
      wrap.style.transform="translateY(0)";
    });

    return {
      update:function(step){ label.textContent = step + ' скроллов'; },
      stopButton:btn,
      wrap
    }
  }

  // --- helpers ---
  function x(p){
    return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
  }
  function parseIntSafe(text){
    const digits = (text || '').replace(/[^\d]/g, ''); // вырезаем всё, кроме цифр (в т.ч. неразрывные пробелы)
    return digits ? Number(digits) : null;
  }

  // --- Основные элементы ---
  const s=x('/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div'); 
  if(!s){ showError('Элемент для скролла не найден'); return; }

  const countXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[1]/div[1]/div[1]/div[1]/div/div/div[1]/div/strong';
  const tXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[2]/div/table';
  const taXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[1]/div/div[2]/div/textarea';
  const bXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[3]/div/div/div/div/div[2]/span/button';

  // --- Условие: скроллим если > 50; при неудачном парсинге — скроллим по умолчанию ---
  const cntEl = x(countXPath);
  const cntParsed = cntEl ? parseIntSafe(cntEl.textContent) : null;
  const shouldScroll = (cntParsed === null) ? true : (cntParsed > 50);

  // --- Проверка таблицы и traceid ---
  const table=x(tXPath);
  if(!table){ showError('Таблица не найдена'); return; }
  const headers=[...table.querySelectorAll('thead tr th')].map(th=>th.innerText.trim());
  const traceIdx=headers.indexOf("message.traceid");
  if(traceIdx===-1){ showError('Трейсы не найдены'); return; }

  // --- Прогресс ---
  let prog=null, step=0, prevRows=0, unchanged=0, stopRequested=false, timerID=null;

  function getRowCount(){
    try{
      const t=x(tXPath);
      if(!t) return 0;
      return t.querySelectorAll('tbody tr').length;
    }catch(e){
      showError('Ошибка при подсчёте строк');
      return 0;
    }
  }

  function runAfterScroll(){
    try{
      let ids=[];
      table.querySelectorAll('tbody tr').forEach(tr=>{
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

      // убираем прогресс, если висит
      if(prog && prog.wrap){
        prog.wrap.remove();
        prog=null;
      }

      showMessage('Трейсы подставлены', false, true);

    }catch(e){
      showError('Что-то пошло не так');
    }
  }

  function scrollLoop(){
    if(!s) return;
    if(stopRequested){ runAfterScroll(); return; }

    try{
      s.scrollTop = s.scrollHeight;
      step++;
      if(prog) prog.update(step);

      timerID = setTimeout(()=>{
        const rows = getRowCount();
        if(rows > prevRows){ prevRows = rows; unchanged = 0; }
        else { unchanged++; }

        if(unchanged < 10 && !stopRequested){
          scrollLoop();
        } else {
          runAfterScroll();
        }
      }, 100);
    }catch(e){
      showError('Ошибка при скролле');
      runAfterScroll();
    }
  }

  // --- Запуск ---
  if(!shouldScroll){
    // мало записей — скролл не нужен
    runAfterScroll();
  } else {
    prog = showProgress();
    prog.stopButton.onclick = ()=>{
      stopRequested = true;
      if(timerID) clearTimeout(timerID);
      runAfterScroll();
    };
    scrollLoop();
  }

})();
