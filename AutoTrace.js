(function(){

  // --- Контейнер уведомлений ---
  let notifContainer = document.getElementById("notif-container");
  if (!notifContainer) {
    notifContainer = document.createElement("div");
    notifContainer.id = "notif-container";
    notifContainer.style.position = "fixed";
    notifContainer.style.bottom = "20px";
    notifContainer.style.right = "20px";
    notifContainer.style.width = "300px";
    notifContainer.style.zIndex = 999999;
    document.body.appendChild(notifContainer);
  }

  const notifications = [];
  const notifHeight = 50;
  const gap = 10;

  function updatePositions() {
    notifications.forEach((notif, i) => {
      notif.style.bottom = `${20 + i * (notifHeight + gap)}px`;
    });
  }

  function showMessage(msg, isError = false, isSuccess = false) {
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = isError ? "#ff4d4f" : isSuccess ? "#52c41a" : "#3498db";
    div.style.color = "white";
    div.style.fontFamily = "sans-serif";
    div.style.fontSize = "14px";
    div.style.width = "300px";
    div.style.position = "absolute";
    div.style.right = "0px";
    div.style.opacity = "0";
    div.style.transform = "translateY(20px)";
    div.style.transition = "all 0.3s ease";

    notifContainer.appendChild(div);
    notifications.push(div);
    updatePositions();

    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(20px)";
      setTimeout(() => {
        notifContainer.removeChild(div);
        const index = notifications.indexOf(div);
        if (index > -1) notifications.splice(index, 1);
        updatePositions();
      }, 300);
    }, 2000);
  }

  function showError(msg){ showMessage(msg, true, false); }
  function showSuccess(msg){ showMessage(msg, false, true); }

  // --- XPath shortcut ---
  function x(p){
    return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
  }

  // --- Основные элементы ---
  const s=x('/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div'); 
  if(!s){showError('Элемент для скролла не найден'); return;}

  const countXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[1]/div[1]/div[1]/div[1]/div/div/div[1]/div/strong';
  const tXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[2]/div/table';
  const taXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[1]/div/div[2]/div/textarea';
  const bXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[3]/div/div/div/div/div[2]/span/button';

  const cntEl=x(countXPath);
  let cnt=cntEl?parseInt(cntEl.textContent.trim(),10):0;

  const table=x(tXPath);
  if(!table){ showError('Таблица не найдена'); return; }
  const headers=[...table.querySelectorAll('thead tr th')].map(th=>th.innerText.trim());
  const traceIdx=headers.indexOf("message.traceid");
  if(traceIdx===-1){ showError('Трейсы не найдены'); return; }

  // --- Прогресс ---
  function showProgress(){
    const wrap=document.createElement('div');
    wrap.style.position='fixed';
    wrap.style.bottom='20px';
    wrap.style.right='20px';
    wrap.style.padding='6px 10px';
    wrap.style.borderRadius='8px';
    wrap.style.background='#3498db';
    wrap.style.color='white';
    wrap.style.fontFamily='sans-serif';
    wrap.style.fontSize='14px';
    wrap.style.zIndex=999999;
    wrap.style.display='flex';
    wrap.style.alignItems='center';
    wrap.style.gap='8px';
    wrap.style.transition='opacity 0.3s ease';

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

    document.body.appendChild(wrap);

    return {
      update:function(step){label.textContent=step+' скроллов';},
      remove:function(){ wrap.style.opacity='0'; setTimeout(()=>wrap.remove(),300); },
      stopButton:btn
    }
  }

  let prog=null, step=0, prevRows=0, unchanged=0, timerID=null;

  function getRowCount(){
    try{
      const table=x(tXPath);
      if(!table)return 0;
      return table.querySelectorAll('tbody tr').length;
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
      });
      ids=[...new Set(ids)];
      const txt="("+ids.map(v=>'"'+v+'"').join(" ")+")";

      const ta=x(taXPath);
      if(ta){
        let setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;
        setter.call(ta,txt);
        ta.dispatchEvent(new Event("input",{bubbles:true}));
        ta.dispatchEvent(new Event("change",{bubbles:true}));
      }
      const b=x(bXPath);
      if(b) b.click();

      if(prog) prog.remove();
      s.scrollTop=0;
      showSuccess("Трейсы подставлены");
    }catch(e){
      if(prog) prog.remove();
      showError('Что-то пошло не так');
    }
  }

  function scrollLoop(){
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

  if(isNaN(cnt)||cnt<=50){
    runAfterScroll();
  }else{
    prog = showProgress();
    prog.stopButton.onclick = ()=>{
      if(timerID) clearTimeout(timerID);
      runAfterScroll();
    };
    scrollLoop();
  }

})();
