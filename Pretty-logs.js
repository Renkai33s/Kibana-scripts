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
    const dateRe = /^[A-Z][a-z]{2} \d{1,2}, \d{4} @/;
    const noiseRe = /^(INFO|DEBUG|WARN|WARNING|ERROR|TRACE|-|–|—)$/i;

    const blocks = [];
    let current = [];

    const push = () => {
      if (current.length) {
        const cleaned = current.filter(l => !noiseRe.test(l));

        // сокращаем дату до 3 знаков после запятой только для строк с датой
        const formatted = cleaned.map(l => {
          if (dateRe.test(l)) {
            return l.replace(/(@ \d{2}:\d{2}:\d{2}\.\d{3})\d*/, '$1');
          }
          return l;
        });

        if (formatted.length) blocks.push(formatted.join(' | '));
        current = [];
      }
    };

    for (const line of lines) {
      if (dateRe.test(line)) {
        push();
        current.push(line);
      } else {
        current.push(line);
      }
    }
    push();

    const out = blocks.join('\n');
    if (!out) {
      showError("Нет полезных логов для копирования");
      return;
    }

    navigator.clipboard.writeText(out)
      .then(() => showSuccess("Логи скопированы"))
      .catch(() => showError("Что-то пошло не так"));
  } catch (e) {
    showError("Что-то пошло не так");
  }

})();
