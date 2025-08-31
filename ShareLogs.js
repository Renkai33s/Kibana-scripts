(function() {
    // Берём текущий URL
    const currentUrl = window.location.href;
    const url = new URL(currentUrl);
    let hash = url.hash;

    // Заменяем /view/<id> на /discover
    hash = hash.replace(/\/view\/[0-9a-f\-]+/, '/discover');

    // Убираем savedSearch внутри _a
    hash = hash.replace(/savedSearch:'[0-9a-f\-]+'/, '');

    // Обновляем хэш
    url.hash = hash;

    // Копируем ссылку в буфер и выводим
    const cleanedUrl = url.toString();
    console.log('Чистая ссылка:', cleanedUrl);

    // Автокопирование в буфер обмена
    navigator.clipboard.writeText(cleanedUrl).then(() => {
        alert('Чистая ссылка скопирована в буфер!');
    }).catch(() => {
        alert('Ссылка: ' + cleanedUrl);
    });
})();
