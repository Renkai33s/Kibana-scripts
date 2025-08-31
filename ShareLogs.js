(function(){

  // --- Уведомления ---
  if (!window.__notifContainer) {
    const container = document.createElement("div");
    container.id = "notif-container";
    container.style.position = "fixed";
    container.style.bottom = "20px";
    container.style.right = "20px";
    container.style.width = "auto";
    container.style.zIndex = 999999;
    document.body.appendChild(container);
    window.__notifContainer = container;
    window.__currentNotif = null;
  }

  function showMessage(msg, isError=false, isSuccess=false){
    if(window.__currentNotif){ window.__currentNotif.remove(); window.__currentNotif=null; }
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = isError?"#ff4d4f":isSuccess?"#52c41a":"#3498db";
    div.style.color="white";
    div.style.fontFamily="sans-serif";
    div.style.fontSize="14px";
    div.style.minWidth="120px";
    div.style.textAlign="center";
    div.style.boxShadow="0 2px 6px rgba(0,0,0,0.2)";
    window.__notifContainer.appendChild(div);
    window.__currentNotif=div;
    setTimeout(()=>{ if(window.__currentNotif===div){ div.remove(); window.__currentNotif=null; } },2000);
  }
  function showError(msg){ showMessage(msg,true,false); }
  function showSuccess(msg){ showMessage(msg,false,true); }

  // --- Основная логика ---
  try {
    let url = window.location.href;
    
    // Разделяем base и query
    let [base, query] = url.split('?');
    if(!query) throw new Error("Нет параметров URL");

    // Парсим параметры
    let params = {};
    query.split('&').forEach(p=>{ let [k,v]=p.split('='); params[k]=decodeURIComponent(v||''); });

    // Убираем savedSearch из _a
    if(params['_a']) params['_a'] = encodeURIComponent(params['_a'].replace(/savedSearch:'[^']*',?/,''));

    // Собираем чистый URL Kibana
    let newQuery = Object.entries(params).map(([k,v])=>`${k}=${v}`).join('&');
    let cleanUrl = `${base}?${newQuery}`;

    // Создаём невидимый iframe для “чистой загрузки”
    let iframe = document.createElement('iframe');
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // Загружаем blank и потом редиректим
    iframe.src = 'about:blank';
    iframe.onload = () => {
      showSuccess("Открываю Kibana без savedSearch в том же окне...");
      iframe.contentWindow.location.replace(cleanUrl);
      setTimeout(()=>{ document.body.removeChild(iframe); }, 3000);
    };

  } catch(e){
    showError("Ошибка: "+e.message);
  }

})();
