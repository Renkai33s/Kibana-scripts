javascript:(function(){
    (async function() {
        // Встроенный код для очистки ссылки
        const risonScript = document.createElement('script');
        risonScript.src = 'https://cdn.jsdelivr.net/npm/rison@0.0.1/rison.js';
        document.head.appendChild(risonScript);
        await new Promise(res => risonScript.onload = res);

        const url = new URL(window.location.href);
        const hash = url.hash;

        const match = hash.match(/_a=([^&]*)/);
        if (!match) return alert('_a не найден');

        const aRison = decodeURIComponent(match[1]);
        const aObj = rison.decode(aRison);

        if (aObj.discover && aObj.discover.savedSearch) delete aObj.discover.savedSearch;

        const newARison = rison.encode(aObj);
        const newHash = hash.replace(/_a=[^&]*/, `_a=${encodeURIComponent(newARison)}`)
                            .replace(/\/view\/[0-9a-f\-]+/, '/discover');

        url.hash = newHash;
        const cleanedUrl = url.toString();

        navigator.clipboard.writeText(cleanedUrl).then(() => alert('Чистая ссылка с индексом скопирована в буфер!'));
        console.log('Чистая ссылка:', cleanedUrl);
    })();
})();
