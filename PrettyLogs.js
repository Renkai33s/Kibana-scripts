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
    notifContainer.style.zIndex = 999999;
    document.body.appendChild(notifContainer);
  }

  let currentNotif = null;
  function showMessage(msg, isError = false, isSuccess = false) {
    if (currentNotif) currentNotif.remove();
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = isError ? "#ff4d4f" : isSuccess ? "#52c41a" : "#3498db";
    div.style.color = "white";
    div.style.fontFamily = "sans-serif";
    div.style.fontSize = "14px";
    notifContainer.appendChild(div);
    currentNotif = div;
    setTimeout(() => {
      if (currentNotif === div) {
        div.remove();
        currentNotif = null;
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
