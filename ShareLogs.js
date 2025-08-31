(function() {
    // Получаем текущий URL
    const currentUrl = window.location.href;

    // Создаём объект URL
    const url = new URL(currentUrl);

    // Получаем параметры _a
    let _a = url.searchParams.get('_a');

    if (_a) {
        try {
            // Декодируем _a
            let decoded = decodeURIComponent(_a);

            // Используем регулярное выражение, чтобы удалить savedSearch и её значение
            // Удаляет pattern вида savedSearch:'...'
            decoded = decoded.replace(/,?savedSearch:'[^']*'/, '');

            // Кодируем обратно
            url.searchParams.set('_a', encodeURIComponent(decoded));

            // Переходим по обновлённому URL
            window.location.href = url.toString();
        } catch (e) {
            console.error('Ошибка при обработке _a:', e);
        }
    } else {
        console.log('Параметр _a не найден в URL');
    }
})();
