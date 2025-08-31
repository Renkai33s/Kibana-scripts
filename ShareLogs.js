(function() {
    try {
        // Проверяем, что объект chrome или OpenSearch Dashboards API доступен
        if (!window.kbn || !window.kbn.$rootScope) {
            alert('Не найден объект kbn, страница еще не загружена полностью');
            return;
        }

        // Получаем состояние приложения через Angular scope
        const $rootScope = window.kbn.$rootScope;
        const appState = $rootScope.$$childHead?.appState || $rootScope.appState;

        if (!appState) {
            alert('Не удалось получить состояние приложения');
            return;
        }

        // Формируем объект _a (активные параметры) и _g (глобальные параметры)
        const _a = appState._a || {};
        const _g = appState._g || {};

        // Формируем новый URL без saved search
        const origin = window.location.origin;
        const newUrl = `${origin}/app/data-explorer/discover#/?_g=${encodeURIComponent(JSON.stringify(_g))}&_a=${encodeURIComponent(JSON.stringify(_a))}`;

        // Копируем в буфер обмена
        navigator.clipboard.writeText(newUrl).then(() => {
            alert('Новая ссылка скопирована в буфер обмена:\n' + newUrl);
        }).catch(err => {
            alert('Ошибка при копировании ссылки: ' + err);
        });

    } catch (e) {
        alert('Ошибка: ' + e);
    }
})();
