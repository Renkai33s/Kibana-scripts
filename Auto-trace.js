(function () {
  // --- Уведомления ---
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

  function showMessage(text, isError = false, isSuccess = false) {
    if (window.__currentNotif) {
      window.__currentNotif.remove();
      window.__currentNotif = null;
    }
    const el = document.createElement("div");
    el.textContent = text;
    el.style.padding = "10px 15px";
    el.style.borderRadius = "8px";
    el.style.background = isError ? "#ff4d4f" : isSuccess ? "#52c41a" : "#3498db";
    el.style.color = "white";
    el.style.fontFamily = "sans-serif";
    el.style.fontSize = "14px";
    el.style.minWidth = "120px";
    el.style.textAlign = "center";
    el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    window.__notifContainer.appendChild(el);
    window.__currentNotif = el;

    setTimeout(() => {
      if (window.__currentNotif === el) {
        el.remove();
        window.__currentNotif = null;
      }
    }, 2000);
  }

  function showError(msg) {
    showMessage(msg, true, false);
  }

  function showSuccess(msg) {
    showMessage(msg, false, true);
  }

  function showLimit(msg) {
    showMessage(msg, false, true);
  }

  // --- Вспомогательные ---
  function x(xpath) {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }

  const scrollable = x(
    "/html/body/div[1]/div/div/div/div[2]/div/div/div/div/div[2]/div/div/div"
  );
  if (!scrollable) {
    showError("Элемент для скролла не найден");
    return;
  }

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
    const popover = document.querySelector(".dscSidebarItem__fieldPopoverPanel");
    if (!popover) return [];
    let traces = [];
    popover
      .querySelectorAll(
        '[data-test-subj="fieldVisualizeBucketContainer"] .euiText[title]'
      )
      .forEach((el) => {
        traces.push(el.innerText.trim());
      });
    return [...new Set(traces)];
  }

  // --- НОВОЕ: определение выделенного трейса ---
  function getSelectedTraceFromTable(traceIdx) {
    try {
      const table = x(tableXPath);
      if (!table) return null;

      // Пытаемся найти "реально" выделенную строку разными способами
      const selRow =
        table.querySelector('tbody tr[aria-selected="true"]') ||
        table.querySelector("tbody tr.euiTableRow-isSelected") ||
        table.querySelector("tbody tr.selected");

      if (!selRow) return null;

      const cell = selRow.children[traceIdx];
      const val = cell && cell.innerText ? cell.innerText.trim() : "";
      if (val && val !== "-") return val;

      return null;
    } catch (e) {
      return null;
    }
  }

  // Переиспользуемая вставка с возможностью кастомного уведомления
  function insertAndRun(traces, tLimit = false, overrideMsg = null) {
    if (traces.length === 0) {
      showError("Трейсы не найдены");
      return;
    }
    const value = "(" + traces.map((t) => `"${t}"`).join(" ") + ")";
    const textarea = x(textareaXPath);
    if (textarea) {
      let setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      ).set;
      setter.call(textarea, value);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const btn = x(buttonXPath);
    if (btn) btn.click();

    if (overrideMsg) {
      showMessage(overrideMsg, false, true);
    } else if (tLimit) {
      showLimit("Достигнут лимит в 20 трейсов");
    } else {
      showSuccess("Трейсы подставлены");
    }
  }

  // --- Логика подсчета ---
  const cntEl = x(countXPath);
  let cnt = 0;
  if (cntEl && cntEl.textContent) {
    const num = cntEl.textContent.replace(/\D/g, "");
    cnt = parseInt(num, 10) || 0;
    console.log("cntEl.textContent:", cntEl.textContent, "=> cnt:", cnt);
  }

  const table = x(tableXPath);
  if (!table) {
    showError("Таблица не найдена");
    return;
  }
  const headers = [...table.querySelectorAll("thead tr th")].map((th) =>
    th.innerText.trim()
  );
  const traceIdx = headers.indexOf("message.traceid");
  if (traceIdx === -1) {
    showError("Трейсы не найдены");
    return;
  }

  // --- НОВОЕ: короткое замыкание, если уже есть выделенный трейс ---
  const preselectedTrace = getSelectedTraceFromTable(traceIdx);
  if (preselectedTrace) {
    insertAndRun([preselectedTrace], false, "Подставлен только выделенный трейс");
    return; // Ничего больше не ищем
  }

  // --- Прогресс бар ---
  function showProgress() {
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.bottom = "20px";
    box.style.right = "20px";
    box.style.padding = "6px 10px";
    box.style.borderRadius = "8px";
    box.style.background = "#3498db";
    box.style.color = "white";
    box.style.fontFamily = "sans-serif";
    box.style.fontSize = "14px";
    box.style.zIndex = 999999;
    box.style.display = "flex";
    box.style.alignItems = "center";
    box.style.gap = "8px";

    const textEl = document.createElement("div");
    textEl.textContent = "0 трейсов";
    box.appendChild(textEl);

    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.padding = "0 4px";
    btn.style.background = "white";
    btn.style.color = "#3498db";
    box.appendChild(btn);

    document.body.appendChild(box);

    return {
      update: function (val) {
        textEl.textContent = val + " трейсов";
      },
      remove: function () {
        box.remove();
      },
      stopButton: btn,
    };
  }

  let prog = null;
  let prevRows = 0;
  let unchanged = 0;
  let timerID = null;
  let didScrollDown = false;

  function runAfterScroll(traces, tLimit = false) {
    try {
      if (prog) prog.remove();
      if (didScrollDown) scrollable.scrollTop = 0;
      insertAndRun(traces, tLimit);
    } catch (e) {
      if (prog) prog.remove();
      if (didScrollDown) scrollable.scrollTop = 0;
      showError("Что-то пошло не так");
    }
  }

  function scrollLoop(traceIdx) {
    if (!scrollable) return;
    try {
      scrollable.scrollTop = scrollable.scrollHeight;
      didScrollDown = true;

      let traces = getTracesFromTable(traceIdx);
      prog && prog.update(traces.length);

      if (traces.length >= 20) {
        if (timerID) clearTimeout(timerID);
        runAfterScroll(traces, true);
        return;
      }

      timerID = setTimeout(() => {
        const rowCount = getRowCount();
        if (rowCount > prevRows) {
          prevRows = rowCount;
          unchanged = 0;
        } else {
          unchanged++;
        }
        if (unchanged < 10) {
          scrollLoop(traceIdx);
        } else {
          runAfterScroll(traces);
        }
      }, 100);
    } catch (e) {
      showError("Ошибка при скролле");
      runAfterScroll(getTracesFromTable(traceIdx));
    }
  }

  function getRowCount() {
    try {
      const table = x(tableXPath);
      return table ? table.querySelectorAll("tbody tr").length : 0;
    } catch (e) {
      return 0;
    }
  }

  // --- Основной алгоритм (если выделенного нет) ---
  const tracesBtn = x(tracesBtnXPath);

  if (cnt <= 50) {
    insertAndRun(getTracesFromTable(traceIdx));
  } else if (tracesBtn) {
    tracesBtn.click();
    setTimeout(() => {
      const traces = getTracesFromPopover();
      tracesBtn.click();

      if (traces.length > 0 && traces.length <= 4) {
        insertAndRun(traces);
      } else if (traces.length > 4) {
        prog = showProgress();
        prog.stopButton.onclick = () => {
          if (timerID) clearTimeout(timerID);
          runAfterScroll(getTracesFromTable(traceIdx));
        };
        scrollLoop(traceIdx);
      } else {
        showError("Не удалось определить количество трейсов");
      }
    }, 500);
  } else {
    showError("Кнопка для открытия трейсов не найдена");
  }
})();
