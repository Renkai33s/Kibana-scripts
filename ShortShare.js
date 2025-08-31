(function run(){
  try {
    const currentHost = location.hostname;

    if (currentHost !== "shlink-ui.yooteam.ru") {
      sessionStorage.setItem("__shlink_url", window.location.href);
      location.href = "https://shlink-ui.yooteam.ru/";
      return;
    }

    const urlToShorten = sessionStorage.getItem("__shlink_url");
    if (!urlToShorten) return;

    // ждём пока прогрузится форма
    const input = document.evaluate(
      "/html/body/div/div/form/div[3]/input",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!input) {
      // форма ещё не готова → повторим через 300мс
      setTimeout(run, 300);
      return;
    }

    const genBtn = document.evaluate(
      "/html/body/div/div/form/div[5]/button",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    const copyBtn = document.evaluate(
      "/html/body/div/div/form/div[4]/button",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!genBtn || !copyBtn) {
      setTimeout(run, 300);
      return;
    }

    input.value = urlToShorten;
    input.dispatchEvent(new Event("input", { bubbles: true }));

    genBtn.click();

    setTimeout(() => {
      copyBtn.click();
      const resultInput = document.querySelector("input[readonly]");
      if (resultInput && resultInput.value) {
        navigator.clipboard.writeText(resultInput.value)
          .then(() => showSuccess("Ссылка скопирована в буфер"))
          .catch(() => showError("Не удалось скопировать"));
      } else {
        showError("Не удалось получить ссылку");
      }
    }, 1000);

  } catch (e) {
    showError("Что-то пошло не так");
  }
})();
