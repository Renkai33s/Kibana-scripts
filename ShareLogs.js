javascript:(function(){
    // Убираем savedSearch из hash
    var hash = window.location.hash;
    var newHash = hash.replace(/,savedSearch:'[^']*'/, '');
    if(newHash !== hash){
        history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
    }

    // Ждем появления кнопки Share
    function clickShareButton() {
        var btn = document.querySelector('[data-test-subj="shareTopNavButton"]') || 
                  document.querySelector('button[aria-label="Share"]');
        if(btn){
            btn.click();
            console.log("Share button clicked!");
            clearInterval(interval);
        }
    }

    var interval = setInterval(clickShareButton, 500);
})();
