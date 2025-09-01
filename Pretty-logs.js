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

    const dateRe = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:,\d+)?/; // YYYY-MM-DD HH:MM:SS,ms
    const levelRe = /\b(INFO|DEBUG|WARN|WARNING|ERROR|TRACE)\b/i;
    const bracketRe = /\[([^\]]+)\]/g; // находит все скобки
    const dashRe = / - /; // для разделителя, если поток/модуль через " - "

    const blocks = [];

    for (const line of lines) {
      if (!line) continue;

      let date = dateRe.exec(line)?.[0];
      let level = levelRe.exec(line)?.[0].toUpperCase();

      // Ищем все скобки
      let brackets = [...line.matchAll(bracketRe)].map(m => m[1]);

      // Поток и модуль
      let thread = brackets[0] || null;
      let module = brackets[1] || null;

      // Если нет скобок, попробуем найти через " - "
      if (!thread || !module) {
        const parts = line.split(dashRe).map(p => p.trim()).filter(Boolean);
        if (!thread && parts[1]) thread = parts[1];
        if (!module && parts[2]) module = parts[2];
      }

      // Сообщение
      let msg = line
        .replace(date || '', '')
        .replace(level || '', '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(dashRe, '')
        .trim();

      const parts = [];
      if (date) parts.push(`[${date}]`);
      if (level) parts.push(`[${level}]`);
      if (thread) parts.push(`[${thread}]`);
      if (module) parts.push(`[${module}]`);
      if (msg) parts.push(`[${msg}]`);

      blocks.push(parts.join(' '));
    }

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
