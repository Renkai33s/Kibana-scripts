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

    // --- Шаг 0: обработка перезагрузки ---
    var url = window.location.href;
    var newUrl = url.replace(/,savedSearch:'[^']*'/, '');
    var needReload = newUrl !== url;

    function runShareFlow() {
        var shareBtn = null;
        var findShareBtn = function(){
            var buttons = document.querySelectorAll('button, a');
            for(var i=0;i<buttons.length;i++){
                if(buttons[i].innerText.trim() === 'Share'){
                    shareBtn = buttons[i];
                    return true;
                }
            }
            return false;
        };

        var clickShortUrlSwitch = function(){
            return new Promise(function(resolve){
                var switchBtn = document.querySelector('button[data-test-subj="useShortUrl"]');
                if(!switchBtn){
                    showError('Кнопка Short URL не найдена');
                    resolve();
                    return;
                }
                if(switchBtn.getAttribute('aria-checked') === 'true'){
                    resolve();
                    return;
                }
                switchBtn.click();
                var interval = setInterval(function(){
                    if(switchBtn.getAttribute('aria-checked') === 'true'){
                        clearInterval(interval);
                        resolve();
                    }
                }, 50);
            });
        };

        var clickCopyLink = function(){
            var copyBtn = document.querySelector('button[data-test-subj="copyShareUrlButton"]');
            if(copyBtn){
                copyBtn.click();
                showSuccess("Ссылка скопирована!");
            } else {
                showError("Кнопка Copy Link не найдена");
            }
        };

        var interval = setInterval(function(){
            if(findShareBtn()){
                clearInterval(interval);
                try {
                    shareBtn.click(); // открыть Share
                    setTimeout(async function(){
                        await clickShortUrlSwitch();
                        clickCopyLink();
                        setTimeout(function(){
                            shareBtn.click(); // закрыть Share
                        }, 200);
                    }, 300);
                } catch(e){
                    showError("Не удалось выполнить действия: " + e.message);
                }
            }
        }, 500);
    }

    if(needReload){
        sessionStorage.setItem('clickShare', 'true');
        history.replaceState(null, '', newUrl);
        window.location.reload();
    } else {
        runShareFlow();
    }

    if(sessionStorage.getItem('clickShare') === 'true'){
        sessionStorage.removeItem('clickShare');
        runShareFlow();
    }

})();
