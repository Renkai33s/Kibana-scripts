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
    const url = window.location.href;

    const input = document.evaluate(
      "/html/body/div/div/form/div[3]/input",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!input) {
      showError("Не найдено поле ввода");
      return;
    }

    input.value = url;
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const genBtn = document.evaluate(
      "/html/body/div/div/form/div[5]/button",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!genBtn) {
      showError("Не найдена кнопка генерации");
      return;
    }

    genBtn.click();

    // --- Ждем появления кнопки копирования ---
    setTimeout(() => {
      try {
        const copyBtn = document.evaluate(
          "/html/body/div/div/form/div[4]/button",
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;

        if (!copyBtn) {
          showError("Кнопка копирования не найдена");
          return;
        }

        copyBtn.click();

        // Ищем сгенерированную короткую ссылку
        const resultInput = document.querySelector("input[readonly]");
        if (resultInput && resultInput.value) {
          navigator.clipboard.writeText(resultInput.value)
            .then(() => showSuccess("Ссылка скопирована в буфер"))
            .catch(() => showError("Что-то пошло не так"));
        } else {
          showError("Не удалось получить ссылку");
        }
      } catch (e) {
        showError("Что-то пошло не так");
      }
    }, 1000);

  } catch (e) {
    showError("Что-то пошло не так");
  }

})();
