javascript:(function(){

  // --- UI: ошибки и прогресс ---
  function showError(msg){
    const wrap=document.createElement('div');
    wrap.textContent=msg;
    wrap.style.position='fixed';
    wrap.style.bottom='20px';
    wrap.style.right='20px';
    wrap.style.padding='10px 15px';
    wrap.style.borderRadius='8px';
    wrap.style.background='#ff4d4f';
    wrap.style.color='white';
    wrap.style.fontFamily='sans-serif';
    wrap.style.fontSize='14px';
    wrap.style.zIndex=999999;
    document.body.appendChild(wrap);
    setTimeout(()=>wrap.remove(),2000);
  }

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
      finish:function(){wrap.style.background='#52c41a';label.textContent='Готово';btn.remove(); setTimeout(()=>wrap.remove(),2000);},
      stopButton:btn
    }
  }

  // --- XPath ---
  function x(p){return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;}

  const s=x('/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div');
  if(!s){showError('Элемент для скролла не найден'); return;}

  const countXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[1]/div[1]/div[1]/div[1]/div/div/div[1]/div/strong';
  const tXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[2]/div/table';
  const taXPath='/html/body/div[1]/div/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[1]/div/div[2]/div/textarea';
  const bXPath='/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[3]/div/div/div/div/div[2]/span/button';

  const cntEl=x(countXPath);
  const cnt=cntEl?parseInt(cntEl.textContent.trim(),10):0;

  // --- Функция финальной обработки ---
  function runAfterScroll(){
    try{
      const table=x(tXPath);
      if(!table){showError('Таблица не найдена'); return;}

      const headers=[...table.querySelectorAll('thead tr th')].map(th=>th.innerText.trim());
      const traceIdx=headers.indexOf("message.traceid");
      if(traceIdx===-1){showError('Трейсы не найдены'); return;}

      let ids=[];
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

      s.scrollTop=0;
      if(prog) prog.finish();
    }catch(e){
      showError('Что-то пошло не так');
    }
  }

  // --- Скролл ---
  function scrollLoop(){
    if(!s) return;
    if(stopRequested){runAfterScroll(); return;}

    try{
      s.scrollTop=s.scrollHeight;
      step++;
      prog.update(step);

      timerID=setTimeout(()=>{
        const rows=getRowCount();
        if(rows>prevRows){prevRows=rows;unchanged=0;} else unchanged++;
        if(unchanged<10 && !stopRequested){scrollLoop();}
        else{runAfterScroll();}
      },100);
    }catch(e){showError('Ошибка при скролле'); runAfterScroll();}
  }

  function getRowCount(){
    try{
      const table=x(tXPath);
      if(!table) return 0;
      return table.querySelectorAll('tbody tr').length;
    }catch(e){showError('Ошибка при подсчёте строк'); return 0;}
  }

  // --- Главная логика ---
  let prog=null, step=0, prevRows=0, unchanged=0, stopRequested=false, timerID=null;

  if(isNaN(cnt) || cnt <= 50){
    runAfterScroll();
  } else {
    prog=showProgress();
    prog.stopButton.onclick=()=>{stopRequested=true; if(timerID) clearTimeout(timerID); runAfterScroll();};
    scrollLoop();
  }

})();
