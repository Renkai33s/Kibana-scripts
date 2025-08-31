(async function() {
    // Подгружаем rison
    if (!window.rison) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/rison@0.0.1/rison.js';
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
        });
    }

    const url = new URL(window.location.href);
    const hash = url.hash;

    // Извлекаем _a
    const match = hash.match(/_a=([^&]*)/);
    if (!match) return alert('_a не найден');

    const aRison = decodeURIComponent(match[1]);
    const aObj = rison.decode(aRison);

    // Убираем savedSearch
    if (aObj.discover && aObj.discover.savedSearch) {
        delete aObj.discover.savedSearch;
    }

    // Собираем обратно
    const newARison = rison.encode(aObj);
    const newHash = hash.replace(/_a=[^&]*/, `_a=${encodeURIComponent(newARison)}`)
                        .replace(/\/view\/[0-9a-f\-]+/, '/discover');

    url.hash = newHash;

    const cleanedUrl = url.toString();
    navigator.clipboard.writeText(cleanedUrl).then(() => {
        alert('Чистая ссылка с индексом скопирована в буфер!');
    });
    console.log('Чистая ссылка:', cleanedUrl);
})();
