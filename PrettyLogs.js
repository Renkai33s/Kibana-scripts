(function(){

  // --- Контейнер для уведомлений (унифицированный с Скриптом 1) ---
  let notifContainer = document.getElementById("notif-container");
  if (!notifContainer) {
    notifContainer = document.createElement("div");
    notifContainer.id = "notif-container";
    notifContainer.style.position = "fixed";
    notifContainer.style.bottom = "20px";
    notifContainer.style.right = "20px";
    notifContainer.style.width = "auto";
    notifContainer.style.height = "0";
    notifContainer.style.display = "flex";
    notifContainer.style.flexDirection = "column";
    notifContainer.style.gap = "10px";
    notifContainer.style.zIndex = 999999;
    document.body.appendChild(notifContainer);
  }

  // --- Анимированное сообщение ---
  function showMessage(msg, isError = false, isSuccess = false) {
    const div = document.createElement("div");
    div.textContent = msg;
@@ -25,58 +28,70 @@
    div.style.opacity = "0";
    div.style.transform = "translateY(20px)";
    div.style.transition = "all 0.3s ease";
    div.style.position = "absolute";
    div.style.right = "0";

    const offset = Array.from(notifContainer.children)
                        .reduce((acc, el) => acc + el.offsetHeight + 10, 0);
    div.style.bottom = offset + "px";

    notifContainer.appendChild(div);

    requestAnimationFrame(()=>{
    // плавное появление
    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    });

    setTimeout(()=>{
    // плавное скрытие
    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(20px)";
      setTimeout(()=>div.remove(),300);
    },2000);
      setTimeout(() => div.remove(), 300);
    }, 2000);
  }
  function showError(msg){ showMessage(msg, true, false); }
  function showSuccess(msg){ showMessage(msg, false, true); }

  // --- Основная логика: проверка выделения и копирование ---
  try {
    const sel = window.getSelection().toString().trim();
    if (!sel) { showError("Логи не выделены"); return; }
    if (!sel) {
      showError("Логи не выделены");
      return;
    }

    const lines = sel.split('\n').map(l=>l.trim()).filter(Boolean);
    // Обработка выделенных строк (как раньше: группировка по дате + фильтр "шума")
    const lines = sel.split('\n').map(l => l.trim()).filter(Boolean);
    const dateRe = /^[A-Z][a-z]{2} \d{1,2}, \d{4} @/;
    const noiseRe = /^(INFO|DEBUG|WARN|WARNING|ERROR|TRACE|-|–|—)$/i;

    const blocks = [];
    let current = [];

    const push = () => {
      if(current.length){
      if (current.length) {
        const cleaned = current.filter(l => !noiseRe.test(l));
        if(cleaned.length) blocks.push(cleaned.join('   '));
        if (cleaned.length) blocks.push(cleaned.join('   '));
        current = [];
      }
    };
    for(const line of lines){
      if(dateRe.test(line)){ push(); current.push(line); } 
      else { current.push(line); }

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
    if(!out){ showError("Нет полезных логов для копирования"); return; }
    if (!out) {
      showError("Нет полезных логов для копирования");
      return;
    }

    navigator.clipboard.writeText(out)
      .then(()=>showSuccess("Логи скопированы"))
      .catch(()=>showError("Что-то пошло не так"));
  } catch(e){ showError("Что-то пошло не так"); }
      .then(() => showSuccess("Логи скопированы"))
      .catch(() => showError("Что-то пошло не так"));
  } catch (e) {
    showError("Что-то пошло не так");
  }

})();
