javascript:(function(){
    (async function(){
        // Загрузка минифицированной версии Rison
        const risonScript = document.createElement('script');
        risonScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/rison/0.1.1/rison.min.js';
        document.head.appendChild(risonScript);
        await new Promise(resolve => risonScript.onload = resolve);

        const url = new URL(window.location.href);
        const hash = url.hash;
        const match = hash.match(/_a=([^&]*)/);
        if (!match) return alert('_a не найден');

        const aObj = rison.decode(decodeURIComponent(match[1]));
        if (aObj.discover && aObj.discover.savedSearch) delete aObj.discover.savedSearch;

        const newARison = rison.encode(aObj);
        const newHash = hash.replace(/_a=[^&]*/, `_a=${encodeURIComponent(newARison)}`)
                            .replace(/\/view\/[0-9a-f\-]+/, '/discover');

        url.hash = newHash;
        const cleanedUrl = url.toString();
        navigator.clipboard.writeText(cleanedUrl).then(() => alert('Чистая ссылка скопирована в буфер обмена!'));
        console.log('Чистая ссылка:', cleanedUrl);
    })();
})();
