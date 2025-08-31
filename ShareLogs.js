(function() {
    try {
        const origin = window.location.origin;
        const hash = window.location.hash;

        // Парсим _g, _q и _a
        const gMatch = hash.match(/_g=([^&]+)/);
        const qMatch = hash.match(/_q=([^&]+)/);
        const aMatch = hash.match(/_a=([^&]+)/);

        if (!gMatch) {
            alert('Не найден параметр _g в URL');
            return;
        }
        const _g = gMatch[1];

        let _aRaw = aMatch ? aMatch[1] : null;
        let _qRaw = qMatch ? qMatch[1] : null;

        if (!_aRaw && !_qRaw) {
            alert('Не найден параметр _a или _q в URL');
            return;
        }

        // Декодируем _a или _q в объект
        let _aObj;
        try {
            _aObj = _aRaw ? JSON.parse(decodeURIComponent(_aRaw)) : JSON.parse(decodeURIComponent(_qRaw));
        } catch(e) {
            alert('Ошибка декодирования _a/_q: ' + e);
            return;
        }

        // Сохраняем indexPattern, если он есть в metadata
        if (_aObj.metadata && _aObj.metadata.indexPattern) {
            _aObj.metadata.indexPattern = _aObj.metadata.indexPattern;
        }

        // Сериализуем обратно
        const _aFixed = encodeURIComponent(JSON.stringify(_aObj));

        // Новый URL без saved search
        const newUrl = `${origin}/app/data-explorer/discover#?_a=${_aFixed}&_g=${_g}&_q=${_aFixed}`;

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
