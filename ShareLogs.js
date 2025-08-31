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

  function showMessage(msg, isError = false, isSuccess = false) {
    if (window.__currentNotif) {
      window.__currentNotif.remove();
      window.__currentNotif = null;
    }
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = isError ? "#ff4d4f" : isSuccess ? "#52c41a" : "#3498db";
    div.style.color = "white";
    div.style.fontFamily = "sans-serif";
    div.style.fontSize = "14px";
    div.style.minWidth = "120px";
    div.style.textAlign = "center";
    div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    window.__notifContainer.appendChild(div);
    window.__currentNotif = div;

    setTimeout(() => {
      if (window.__currentNotif === div) {
        div.remove();
        window.__currentNotif = null;
      }
    }, 2000);
  }

  function showError(msg){ showMessage(msg, true, false); }
  function showSuccess(msg){ showMessage(msg, false, true); }

  // --- Основная логика ---
  try {
    let url = window.location.href;
    
    // Разделяем base и query
    let [base, query] = url.split('?');
    if(!query) throw new Error("Нет параметров URL");

    // Парсим параметры
    let params = {};
    query.split('&').forEach(p => {
      let [k,v] = p.split('=');
      params[k] = decodeURIComponent(v || '');
    });

    // Убираем savedSearch
    if(params['_a']){
      params['_a'] = params['_a'].replace(/savedSearch:'[^']*',?/,'');
      params['_a'] = encodeURIComponent(params['_a']);
    }

    // Собираем новый URL
    let cleanUrl = `${base}?${Object.entries(params).map(([k,v]) => `${k}=${v}`).join('&')}`;

    // --- Эмуляция вставки ссылки в shlink-ui ---
    let iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://shlink-ui.yooteam.ru/';
    document.body.appendChild(iframe);

    iframe.onload = function() {
      try {
        let doc = iframe.contentDocument || iframe.contentWindow.document;
        let input = doc.querySelector('#longURL');
        let btn = doc.querySelector('#btn');
        let shortInput = doc.querySelector('#shortURL');

        if (!input || !btn || !shortInput) {
          showError('Не удалось найти элементы для сокращения ссылки');
          return;
        }

        input.value = cleanUrl;      // вставляем ссылку
        btn.click();                 // нажимаем сократить

        // Ждём появления результата
        let checkInterval = setInterval(() => {
          if (shortInput.value && shortInput.value.startsWith('http')) {
            clearInterval(checkInterval);
            navigator.clipboard.writeText(shortInput.value)
              .then(() => showSuccess('Сокращённая ссылка скопирована!'))
              .catch(() => showError('Не удалось скопировать ссылку'));
            document.body.removeChild(iframe);
          }
        }, 500);

      } catch(e) {
        showError('Ошибка при взаимодействии с shlink-ui');
      }
    }

  } catch (e) {
    showError("Ошибка: " + e.message);
  }

})();
