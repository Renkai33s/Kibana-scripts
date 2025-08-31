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
    function clickShortUrlSwitch() {
        return new Promise(function(resolve){
            const switchBtn = document.querySelector('button[data-test-subj="useShortUrl"]');
            if (!switchBtn) {
                showError('Кнопка Short URL не найдена');
                resolve(false);
                return;
            }
            if (switchBtn.getAttribute('aria-checked') === 'true') {
                resolve(false); // Short URL уже включён
                return;
            }
            switchBtn.click();
            const interval = setInterval(function(){
                if (switchBtn.getAttribute('aria-checked') === 'true') {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 50);
        });
    }

    function clickCopyLink() {
        const copyBtn = document.querySelector('button[data-test-subj="copyShareUrlButton"]');
        if(copyBtn){
            copyBtn.click();
            showSuccess("Ссылка скопирована!");
        } else {
            showError("Кнопка Copy Link не найдена");
        }
    }

    function openShareMenu() {
        return new Promise(function(resolve){
            const shareBtn = document.querySelector('button[data-test-subj="shareContextMenuButton"]');
            if(!shareBtn){
                showError('Кнопка Share не найдена');
                resolve(false);
                return;
            }
            shareBtn.click();
            setTimeout(()=>resolve(true), 300);
        });
    }

    async function runScript(){
        const menuOpened = await openShareMenu();
        if(!menuOpened) return;

        const switched = await clickShortUrlSwitch(); // включаем Short URL, если не включён
        if(!switched) {
            // Если Short URL уже был включён, просто ждем немного, чтобы меню загрузилось
            await new Promise(r => setTimeout(r, 200));
        }

        clickCopyLink();

        // Закрываем меню Share
        const shareBtn = document.querySelector('button[data-test-subj="shareContextMenuButton"]');
        if(shareBtn) shareBtn.click();
    }

    runScript();
})();
