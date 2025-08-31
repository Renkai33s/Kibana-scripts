(function() {

  // --- Минимальный RISON-парсер ---
  // Источник: https://github.com/Nanonid/rison (упрощённая версия)
  const rison = {
    decode: function(s) {
      // Используем eval как быстрый способ для простого RISON
      try {
        // Преобразуем RISON в JSON-подобный синтаксис
        let jsonish = s.replace(/!/g,'').replace(/([a-zA-Z0-9_]+):/g,'"$1":').replace(/'/g,'"');
        return JSON.parse(jsonish);
      } catch(e) { throw new Error("Ошибка парсинга RISON"); }
    },
    encode: function(obj) {
      function recur(o){
        if(o===null) return 'null';
        if(Array.isArray(o)) return '!(' + o.map(recur).join(',') + ')';
        if(typeof o==='object') return '(' + Object.entries(o).map(([k,v])=>k+':'+recur(v)).join(',') + ')';
        if(typeof o==='string') return `"${o}"`;
        return o.toString();
      }
      return recur(obj);
    }
  };

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

  // --- Удаление savedSearch рекурсивно ---
  function removeSavedSearch(obj){
    if(typeof obj !== 'object' || !obj) return;
    if('savedSearch' in obj) delete obj.savedSearch;
    Object.values(obj).forEach(removeSavedSearch);
  }

  // --- Основная логика ---
  try {
    let url = window.location.href;
    let [base, query] = url.split('?');
    if(!query) throw new Error("Нет параметров URL");

    // Парсим параметры
    let params = {};
    query.split('&').forEach(p => { let [k,v] = p.split('='); params[k] = decodeURIComponent(v || ''); });

    // Обрабатываем _a
    if(params['_a']){
      let aObj = rison.decode(params['_a']);
      removeSavedSearch(aObj);
      params['_a'] = rison.encode(aObj);
    }

    // Обрабатываем _q (если есть)
    if(params['_q']){
      let qObj = rison.decode(params['_q']);
      removeSavedSearch(qObj);
      params['_q'] = rison.encode(qObj);
    }

    // Собираем новый URL
    let newQuery = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    let cleanUrl = `${base}?${newQuery}`;

    showSuccess("Перезагружаю Kibana без savedSearch...");
    window.location.replace(cleanUrl);

  } catch(e){
    showError("Ошибка: "+e.message);
  }

})();
