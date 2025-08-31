(function() {
    try {
        const hash = window.location.hash; // берем хэш полностью
        const origin = window.location.origin;

        // Ищем _g и _a или _q
        const gMatch = hash.match(/_g=([^&]+)/);
        const aMatch = hash.match(/_a=([^&]+)/) || hash.match(/_q=([^&]+)/);

        if (!gMatch || !aMatch) {
            alert('Не удалось найти параметры _g или _a/_q в URL');
            return;
        }

        const _g = gMatch[1];
        const _a = aMatch[1];

        // Новый URL без view/<id>
        const newUrl = `${origin}/app/data-explorer/discover#/?_g=${_g}&_a=${_a}`;

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
