javascript:(function(){
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
    function waitForElement(selector, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(selector);
            if(el) return resolve(el);
            let elapsed = 0;
            const interval = setInterval(() => {
                const e = document.querySelector(selector);
                if(e) { clearInterval(interval); resolve(e); }
                elapsed += 50;
                if(elapsed >= timeout){ clearInterval(interval); reject(null); }
            }, 50);
        });
    }

    async function run() {
        try {
            // --- открыть меню, если оно закрыто ---
            const menu = document.querySelector('div[data-test-subj="shareContextMenu"]');
            if(!menu) {
                const shareBtn = document.querySelector('button[data-test-subj="shareContextMenuButton"]');
                if(!shareBtn){ showError('Кнопка Share не найдена'); return; }
                shareBtn.click();
                await new Promise(r => setTimeout(r, 300)); // подождать открытия меню
            }

            // --- включить Short URL если нужно ---
            const switchBtn = await waitForElement('button[data-test-subj="useShortUrl"]');
            if(switchBtn.getAttribute('aria-checked') === 'false') {
                switchBtn.click();
                await new Promise(r => {
                    const interval = setInterval(() => {
                        if(switchBtn.getAttribute('aria-checked') === 'true'){
                            clearInterval(interval);
                            r();
                        }
                    }, 50);
                });
            }

            // --- кликнуть Copy Link ---
            const copyBtn = await waitForElement('button[data-test-subj="copyShareUrlButton"]');
            copyBtn.click();
            showSuccess('Ссылка скопирована!');

            // --- закрыть меню ---
            const shareBtn = document.querySelector('button[data-test-subj="shareContextMenuButton"]');
            if(shareBtn) shareBtn.click();

        } catch(e) {
            showError('Не удалось выполнить скрипт');
            console.error(e);
        }
    }

    run();
})();
