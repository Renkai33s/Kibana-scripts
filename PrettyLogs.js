(function(){

  // --- Глобальная система уведомлений с плавной анимацией ---
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
      const oldNotif = window.__currentNotif;
      if (oldNotif) {
          oldNotif.style.opacity = '0';
          setTimeout(() => oldNotif.remove(), 300);
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
      div.style.opacity = '0';
      div.style.transition = 'opacity 0.3s ease';

      window.__notifContainer.appendChild(div);
      window.__currentNotif = div;

      // Принудительно «отрисовать» начальное состояние
      div.getBoundingClientRect();
      div.style.opacity = '1';

      setTimeout(() => {
          if (window.__currentNotif === div) {
              div.style.opacity = '0';
              setTimeout(() => {
                  if (window.__currentNotif === div) window.__currentNotif = null;
                  div.remove();
              }, 300);
          }
      }, 2000);
  }

  function showError(msg){ showMessage(msg, true, false); }
  function showSuccess(msg){ showMessage(msg, false, true); }

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
        if (cleaned.length) blocks.push(cleaned.join('   '));
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
