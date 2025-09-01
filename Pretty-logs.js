(function(){

  // --- Глобальная система уведомлений ---
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
    const sel = window.getSelection().toString().trim();
    if (!sel) {
      showError("Логи не выделены");
      return;
    }

    const lines = sel.split('\n').map(l => l.trim()).filter(Boolean);

    // Находим заголовки
    let headers = [];
    let headerLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("Time") && line.includes("message.traceid")) {
        headers = line.split(',').map(h => h.trim());
        headerLineIndex = i;
        break;
      }
    }

    if (!headers.length) {
      showError("Заголовки не найдены");
      return;
    }

    const dataLines = lines.slice(headerLineIndex + 1);
    const processed = [];

    for (const line of dataLines) {
      const parts = line.split(',').map(p => p.trim());
      const row = [];

      headers.forEach((h, i) => {
        let val = parts[i] || '';
        if (["message.traceid","message.methodid","message.name"].includes(h)) {
          val = `[${val}]`;
        }
        row.push(val);
      });

      if (row.length) processed.push(row.join(' '));
    }

    if (!processed.length) {
      showError("Нет полезных логов для копирования");
      return;
    }

    navigator.clipboard.writeText(processed.join('\n'))
      .then(() => showSuccess("Логи скопированы"))
      .catch(() => showError("Что-то пошло не так"));

  } catch (e) {
    showError("Что-то пошло не так");
  }

})();
