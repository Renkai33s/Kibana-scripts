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
    const url = window.location.href; // текущий URL

    // TinyURL API
    fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(url))
      .then(r => r.text())
      .then(shortUrl => {
        if(shortUrl && shortUrl.startsWith('http')){
          navigator.clipboard.writeText(shortUrl)
            .then(() => showSuccess("Скопировано в буфер"))
            .catch(() => showError("Что-то пошло не так"));
        } else {
          showError("Не удалось сократить ссылку");
        }
      })
      .catch(() => showError("Что-то пошло не так"));

  } catch (e) {
    showError("Что-то пошло не так");
  }

})();
