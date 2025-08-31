(function() {
    try {
        const origin = window.location.origin;
        const hash = window.location.hash;

        // Парсим _g и _q/_a из текущего хэша
        const gMatch = hash.match(/_g=([^&]+)/);
        const qMatch = hash.match(/_q=([^&]+)/);
        const aMatch = hash.match(/_a=([^&]+)/);

        if (!gMatch) {
            alert('Не найден параметр _g в URL');
            return;
        }

        const _g = gMatch[1];
        // Если есть _q, используем его, иначе _a
        const _a = qMatch ? qMatch[1] : (aMatch ? aMatch[1] : null);

        if (!_a) {
            alert('Не найден параметр _q или _a в URL');
            return;
        }

        // Формируем новый URL без view/<id>
        const newUrl = `${origin}/app/data-explorer/discover#?_a=${_a}&_g=${_g}&_q=${_a}`;

        // Копируем в буфер
        navigator.clipboard.writeText(newUrl).then(() => {
            alert('Новая ссылка скопирована в буфер:\n' + newUrl);
        }).catch(err => {
            alert('Ошибка копирования: ' + err);
        });

    } catch (e) {
        alert('Ошибка: ' + e);
    }
})();
