javascript:(function(){
    var url = window.location.href;
    var newUrl = url.replace(/,savedSearch:'[^']*'/, '');
    if(newUrl !== url){
        history.replaceState(null, '', newUrl);
        window.location.reload();
    }
})();
