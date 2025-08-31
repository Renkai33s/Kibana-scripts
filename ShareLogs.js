javascript:(function(){
    // Скопировать текущий URL в буфер
    navigator.clipboard.writeText(window.location.href)
        .then(() => {
            // Открыть новое окно с нужным адресом
            window.open('https://s.yooteam.ru', '_blank');
        })
        .catch(err => alert('Ошибка при копировании ссылки: ' + err));
})();
