(function(){
  // --- Уведомления (как в твоём шаблоне) ---
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

  // --- Настройки (можно подправить) ---
  const WAIT_INTERVAL_MS = 250;    // как часто пытаем найти элемент
  const MAX_WAIT_MS = 8000;        // максимально ждём появление элемента
  const AFTER_GEN_WAIT_MS = 1200;  // после клика "генерировать" ждём немного перед поиском кнопки копирования

  // --- Вспомогательные функции ---
  function evalXPath(xpath){
    try {
      return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch(e) {
      return null;
    }
  }

  function logDebug(...args){ console.debug("[shlink-helper]", ...args); }

  async function waitForFinder(fn, timeoutMs = MAX_WAIT_MS){
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const el = fn();
        if (el) return el;
      } catch(e){}
      await new Promise(r => setTimeout(r, WAIT_INTERVAL_MS));
    }
    return null;
  }

  function scanInputsByHeuristics(){
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const el of inputs){
      const attrs = ((el.placeholder||"") + " " + (el.name||"") + " " + (el.id||"") + " " + (el.getAttribute('aria-label')||"")).toLowerCase();
      if (attrs.includes('url') || attrs.includes('ссыл') || attrs.includes('link')) return el;
    }
    return null;
  }

  function scanButtonsByHeuristics(){
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const b of buttons){
      const txt = (b.textContent || b.getAttribute('aria-label') || "").trim().toLowerCase();
      if (/копир|скопи|copy|copy link|copy url/i.test(txt)) return b;
      // атрибуты для clipboard.js и т.п.
      if (b.hasAttribute('data-clipboard-target') || b.hasAttribute('data-clipboard-text')) return b;
    }
    // ещё попытка — кнопки внутри формы
    const formBtns = Array.from(document.querySelectorAll('form button'));
    if (formBtns.length) return formBtns[formBtns.length-1]; // как запасной вариант — последняя в форме
    return null;
  }

  // --- Основная логика ---
  (async function main(){
    try {
      logDebug("start", location.href);

      const urlToInsert = window.location.href;
      logDebug("urlToInsert:", urlToInsert);

      // 1) НАХОДИМ ПОЛЕ ВВОДА (несколько попыток)
      const inputSelectors = [
        {type:'xpath', val: '/html/body/div/div/form/div[3]/input'}, // исходный xpath
        {type:'css', val: 'form input[type="url"]'},
        {type:'css', val: 'form input'}, // первый input в форме
        {type:'css', val: 'input[name*="url"]'},
        {type:'css', val: 'input[id*="url"]'},
      ];

      const triedInputs = [];
      const inputEl = await waitForFinder(() => {
        // пробуем xpath/css-список
        for (const s of inputSelectors){
          try {
            let el = null;
            if (s.type === 'xpath') el = evalXPath(s.val);
            else el = document.querySelector(s.val);
            triedInputs.push(s.val);
            if (el) return el;
          } catch(e){}
        }
        // heuristics scan
        const h = scanInputsByHeuristics();
        triedInputs.push('heuristic-scan');
        if (h) return h;
        return null;
      });

      if (!inputEl) {
        console.warn("[shlink-helper] tried input selectors:", triedInputs);
        showError("Не найдено поле ввода");
        return;
      }
      logDebug("found input", inputEl);

      // вставляем URL
      try {
        inputEl.focus && inputEl.focus();
        inputEl.value = urlToInsert;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      } catch(e){
        logDebug("failed to set input.value", e);
      }

      // 2) НАХОДИМ И НАЖИМАЕМ КНОПКУ "СГЕНЕРИРОВАТЬ"
      const genBtnSelectors = [
        {type:'xpath', val: '/html/body/div/div/form/div[5]/button'}, // исходный xpath
        {type:'css', val: 'form button[type="submit"]'},
        {type:'css', val: 'form button'},
      ];
      const triedGen = [];
      const genBtn = await waitForFinder(() => {
        for (const s of genBtnSelectors){
          try {
            let el = s.type === 'xpath' ? evalXPath(s.val) : document.querySelector(s.val);
            triedGen.push(s.val);
            if (el) return el;
          } catch(e){}
        }
        // пробуем кнопку с текстом "Generate"/"Shorten"/"Сгенерировать"
        const allBtns = Array.from(document.querySelectorAll('button'));
        const found = allBtns.find(b => /generate|shorten|create|сгенер|сокр|коротк/i.test(b.textContent || b.getAttribute('aria-label') || ""));
        if (found) {
          triedGen.push('text-heuristic');
          return found;
        }
        return null;
      });

      if (!genBtn) {
        console.warn("[shlink-helper] tried gen btn selectors:", triedGen);
        showError("Не найдена кнопка генерации");
        return;
      }
      logDebug("found genBtn", genBtn);
      genBtn.click();

      // 3) ЖДЁМ НЕМНОГО И ИЩЕМ КНОПКУ "КОПИРОВАТЬ"
      await new Promise(r => setTimeout(r, AFTER_GEN_WAIT_MS));

      const copyBtnSelectors = [
        {type:'xpath', val: '/html/body/div/div/form/div[4]/button'}, // твой xpath для копирования
      ];
      const triedCopy = [];
      const copyBtn = await waitForFinder(() => {
        // 1) xpath
        for (const s of copyBtnSelectors){
          try {
            const el = evalXPath(s.val);
            triedCopy.push(s.val);
            if (el) return el;
          } catch(e){}
        }
        // 2) heuristics (текст кнопки, data-clipboard и т.п.)
        const h = scanButtonsByHeuristics();
        triedCopy.push('heuristic-scan-buttons');
        if (h) return h;
        return null;
      }, MAX_WAIT_MS);

      if (!copyBtn) {
        console.warn("[shlink-helper] tried copy btn selectors:", triedCopy);
        showError("Кнопка копирования не найдена");
        return;
      }
      logDebug("found copyBtn", copyBtn);
      copyBtn.click();

      // 4) ПРОВЕРЯЕМ БУФЕР ОБМЕНА — читаем буфер (если доступен)
      try {
        // даём немного времени на внутренний copy
        await new Promise(r => setTimeout(r, 300));
        if (navigator.clipboard && navigator.clipboard.readText) {
          const clip = await navigator.clipboard.readText();
          logDebug("clipboard content:", clip);
          if (clip && clip.includes('http')) {
            showSuccess("Ссылка скопирована в буфер");
            return;
          } else {
            // fallback: попробуем найти readonly input с результатом и скопировать его
            const resultCandidate = document.querySelector('input[readonly], input[aria-readonly="true"]');
            if (resultCandidate && resultCandidate.value) {
              try {
                await navigator.clipboard.writeText(resultCandidate.value);
                showSuccess("Ссылка скопирована в буфер");
                return;
              } catch(e) {
                logDebug("writeText fallback failed", e);
              }
            }
            showError("Что-то пошло не так");
            return;
          }
        } else {
          // нет доступа к чтению буфера — пытаемся взять значение из поля результата
          const resultCandidate = document.querySelector('input[readonly], input[aria-readonly="true"]');
          if (resultCandidate && resultCandidate.value) {
            try {
              await navigator.clipboard.writeText(resultCandidate.value);
              showSuccess("Ссылка скопирована в буфер");
              return;
            } catch(e){
              logDebug("writeText failed", e);
            }
          }
          showError("Что-то пошло не так");
          return;
        }
      } catch (e) {
        logDebug("clipboard check error", e);
        showError("Что-то пошло не так");
        return;
      }

    } catch (e) {
      console.error("[shlink-helper] unexpected error", e);
      showError("Что-то пошло не так");
    }
  })();

})();
