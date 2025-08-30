(function(){

  // --- Контейнер для уведомлений (тот же что и в AutoTrace.js) ---
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

  let notifIndex = 0; // Индекс для позиционирования уведомлений

  // --- Анимированное сообщение ---
  function showMessage(msg, isError = false, isSuccess = false) {
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = isError ? "#ff4d4f" : isSuccess ? "#52c41a" : "#3498db";
    div.style.color = "white";
    div.style.fontFamily = "sans-serif";
    div.style.fontSize = "14px";
    div.style.opacity = "0";
    div.style.position = "absolute";
    div.style.right = "0px";
    div.style.width = "300px";
    const currentIndex = notifIndex;
    div.style.bottom = `${20 + currentIndex * 60}px`; // фиксированное место
    notifIndex++;

    div.style.transition = "all 0.3s ease";

    notifContainer.appendChild(div);

    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(20px)";
      setTimeout(() => div.remove(), 300);
    }, 2000);
  }

  function showError(msg){ showMessage(msg, true, false); }
  function showSuccess(msg){ showMessage(msg, false, true); }

  // --- Основная логика: проверка выделения и копирование ---
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
