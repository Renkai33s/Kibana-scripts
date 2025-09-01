(function () {
  // === Вспомогательные функции ===
  if (!window.__notifContainer) {
    const c = document.createElement("div");
    c.id = "notif-container";
    c.style.position = "fixed";
    c.style.bottom = "20px";
    c.style.right = "20px";
    c.style.width = "auto";
    c.style.zIndex = 999999;
    document.body.appendChild(c);
    window.__notifContainer = c;
    window.__currentNotif = null;
  }

  function showMessage(text, type = "info") {
    if (window.__currentNotif) {
      window.__currentNotif.remove();
      window.__currentNotif = null;
    }
    const div = document.createElement("div");
    div.textContent = text;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background =
      type === "error"
        ? "#ff4d4f"
        : type === "success"
        ? "#52c41a"
        : "#3498db";
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

  const showError = (m) => showMessage(m, "error");
  const showSuccess = (m) => showMessage(m, "success");
  const showInfo = (m) => showMessage(m, "info");

  function x(xpath) {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }

  // === XPath селекторы ===
  const scrollableXPath =
    "/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div";
  const countXPath =
    "/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[1]/div[1]/div[1]/div[1]/div/div/div[1]/div/strong";
  const tableXPath =
    "/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[2]/div[2]/div/table";
  const textareaXPath =
    "/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[1]/div/div[2]/div/textarea";
  const buttonXPath =
    "/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[3]/div/div/div/div/div[2]/span/button";
  const tracesBtnXPath =
    "/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[1]/div/div/div/div[2]/div/div[2]/div[1]/div[1]/div/div/div[3]/div/div/button";

  const scrollable = x(scrollableXPath);
  if (!scrollable) return showError("Элемент для скролла не найден");

  // === Сбор трейсов ===
  function getTracesFromTable(traceIdx) {
    const table = x(tableXPath);
    if (!table) return [];
    let traces = [];
    table.querySelectorAll("tbody tr").forEach((row) => {
      const val = row.children[traceIdx]?.innerText.trim();
      if (val && val !== "-") traces.push(val);
    });
    return [...new Set(traces)];
  }

  function getTracesFromPopover() {
    const pop = document.querySelector(".dscSidebarItem__fieldPopoverPanel");
    if (!pop) return [];
    let traces = [];
    pop.querySelectorAll(
      '[data-test-subj="fieldVisualizeBucketContainer"] .euiText[title]'
    ).forEach((el) => traces.push(el.innerText.trim()));
    return [...new Set(traces)];
  }

  function insertAndRun(traces, limitReached = false) {
    if (traces.length === 0) return showError("Трейсы не найдены");

    const text = "(" + traces.map((t) => `"${t}"`).join(" ") + ")";
    const textarea = x(textareaXPath);
    if (textarea) {
      let setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      ).set;
      setter.call(textarea, text);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const button = x(buttonXPath);
    if (button) button.click();

    if (limitReached) {
      showInfo("Достигнут лимит в 20 трейсов");
    } else {
      showSuccess("Трейсы подставлены");
    }
  }

  // === Прогресс-бар ===
  function createProgress() {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.bottom = "20px";
    div.style.right = "20px";
    div.style.padding = "6px 10px";
    div.style.borderRadius = "8px";
    div.style.background = "#3498db";
    div.style.color = "white";
    div.style.fontFamily = "sans-serif";
    div.style.fontSize = "14px";
    div.style.zIndex = 999999;
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "8px";

    const label = document.createElement("div");
    label.textContent = "0 трейсов";
    div.appendChild(label);

    const stopBtn = document.createElement("button");
    stopBtn.textContent = "×";
    stopBtn.style.fontSize = "12px";
    stopBtn.style.cursor = "pointer";
    stopBtn.style.border = "none";
    stopBtn.style.borderRadius = "4px";
    stopBtn.style.padding = "0 4px";
    stopBtn.style.background = "white";
    stopBtn.style.color = "#3498db";
    div.appendChild(stopBtn);

    document.body.appendChild(div);

    return {
      update: (n) => (label.textContent = `${n} трейсов`),
      remove: () => div.remove(),
      stopButton: stopBtn,
    };
  }

  // === Основная логика ===
  const cntEl = x(countXPath);
  let logCount = 0;
  if (cntEl && cntEl.textContent) {
    const digits = cntEl.textContent.replace(/\D/g, "");
    logCount = parseInt(digits, 10) || 0;
  }

  const table = x(tableXPath);
  if (!table) return showError("Таблица не найдена");

  const headers = [...table.querySelectorAll("thead tr th")].map((th) =>
    th.innerText.trim()
  );
  const traceIdx = headers.indexOf("message.traceid");
  if (traceIdx === -1) return showError("Колонка message.traceid не найдена");

  let prog = null;
  let timerID = null;

  function runAfterScroll(traces, limitReached = false) {
    try {
      prog && prog.remove();
      scrollable.scrollTop = 0;
      insertAndRun(traces, limitReached);
    } catch (e) {
      prog && prog.remove();
      scrollable.scrollTop = 0;
      showError("Ошибка при завершении скролла");
    }
  }

  function scrollLoop() {
    try {
      scrollable.scrollTop = scrollable.scrollHeight;

      let traces = getTracesFromTable(traceIdx);
      prog && prog.update(traces.length);

      if (traces.length >= 20) {
        if (timerID) clearTimeout(timerID);
        return runAfterScroll(traces, true);
      }

      timerID = setTimeout(scrollLoop, 200);
    } catch (e) {
      showError("Ошибка при скролле");
      runAfterScroll(getTracesFromTable(traceIdx));
    }
  }

  const tracesBtn = x(tracesBtnXPath);

  if (logCount <= 50) {
    // без меню и без скролла
    insertAndRun(getTracesFromTable(traceIdx));
  } else if (tracesBtn) {
    tracesBtn.click();
    setTimeout(() => {
      const popoverTraces = getTracesFromPopover();
      tracesBtn.click();

      if (popoverTraces.length > 0 && popoverTraces.length <= 4) {
        insertAndRun(popoverTraces);
      } else if (popoverTraces.length > 4) {
        prog = createProgress();
        prog.stopButton.onclick = () => {
          if (timerID) clearTimeout(timerID);
          runAfterScroll(getTracesFromTable(traceIdx));
        };
        scrollLoop();
      } else {
        showError("Не удалось определить количество трейсов");
      }
    }, 500);
  } else {
    showError("Кнопка для открытия трейсов не найдена");
  }
})();
