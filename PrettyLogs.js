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
    notifContainer.style.gap = "10px";
    notifContainer.style.zIndex = 999999;
    document.body.appendChild(notifContainer);
  }

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
    div.style.transform = "translateY(20px)";
    div.style.transition = "all 0.3s ease";

    notifContainer.appendChild(div);

    // плавное появление
    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    });

    // плавное скрытие
    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(20px)";
      setTimeout(() => div.remove(), 300);
    }, 2000);
  }

  function showError(msg){ showMessage(msg, true, false); }

  // --- XPath helper ---
  function x(p){
    return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
  }

  // --- Основная логика ---
  try{
    const logXPath = '/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[2]/div/table/tbody/tr[1]/td[2]/span';
    const el = x(logXPath);

    if(!el || !el.innerText){
      showError("Не удалось найти лог");
      return;
    }

    const txt = el.innerText.trim();
    navigator.clipboard.writeText(txt).then(()=>{
      showMessage("Скопировано", false, true);
    }).catch(()=>{
      showError("Что-то пошло не так");
    });

  }catch(e){
    showError("Что-то пошло не так");
  }

})();
