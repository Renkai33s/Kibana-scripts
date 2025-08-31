(function() {
    try {
        // Берём текущий URL страницы
        const url = window.location.href;

        // Парсим hash-параметры
        const hash = url.split('#')[1] || '';
        const gMatch = hash.match(/_g=([^&]+)/);
        const qMatch = hash.match(/_q=([^&]+)/);

        if (!gMatch || !qMatch) {
            alert('Не найдены параметры _g или _q в URL');
            return;
        }

        const gParam = gMatch[1];
        const qParam = qMatch[1];

        // Формируем новый URL без view/<id>
        const origin = window.location.origin;
        const newUrl = `${origin}/app/data-explorer/discover#/?_g=${gParam}&_a=${qParam}`;

        // Копируем в буфер
        navigator.clipboard.writeText(newUrl).then(() => {
            alert('Новая ссылка скопирована в буфер:\n' + newUrl);
        }).catch(err => {
            alert('Ошибка при копировании ссылки: ' + err);
        });
    } catch (e) {
        alert('Ошибка: ' + e);
    }
})();
