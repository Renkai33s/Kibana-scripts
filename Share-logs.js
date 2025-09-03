(function(){
    // --- Система уведомлений ---
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

    // --- Проверка и чистка URL без перезагрузки ---
    var url = window.location.href;
    var cleanUrl = url.replace(/,savedSearch:'[^']*'/, '');
    if(cleanUrl !== url){
        history.replaceState(null, '', cleanUrl);
        showMessage("URL очищен, продолжаем...");
    }

    // --- Основной поток: открыть Share, переключить Short URL, скопировать, закрыть ---
    function runShareFlow() {
        var shareBtn = Array.from(document.querySelectorAll('button, a'))
                            .find(b => b.innerText.trim() === 'Share');
        if(!shareBtn){ showError("Кнопка Share не найдена"); return; }

        function clickShortUrlSwitch(){
            return new Promise(resolve => {
                var switchBtn = document.querySelector('button[data-test-subj="useShortUrl"]');
                if(!switchBtn){ showError("Short URL не найден"); resolve(); return; }
                if(switchBtn.getAttribute('aria-checked') === 'true'){ resolve(); return; }
                switchBtn.click();
                var intv = setInterval(()=>{
                    if(switchBtn.getAttribute('aria-checked')==='true'){
                        clearInterval(intv);
                        resolve();
                    }
                }, 50);
            });
        }

        function clickCopyLink(){
            var copyBtn = document.querySelector('button[data-test-subj="copyShareUrlButton"]');
            if(copyBtn){ copyBtn.click(); showSuccess("Ссылка скопирована"); }
            else showError("Кнопка Copy Link не найдена");
        }

        shareBtn.click(); // открыть Share
        setTimeout(async ()=>{
            await clickShortUrlSwitch();
            clickCopyLink();
            setTimeout(()=>shareBtn.click(), 200); // закрыть Share
        }, 300);
    }

    runShareFlow();
})();
