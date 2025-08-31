javascript:(function(){
    (async function(){
        // Минимальная версия Rison (encode/decode)
        const rison = {
            decode: function(s){
                s = decodeURIComponent(s);
                if (s[0] === '(') s = s.slice(1, -1);
                const obj = {};
                s.split(',').forEach(function(pair){
                    const [key, value] = pair.split(':');
                    obj[key] = value === '!t' ? true : value === '!f' ? false : value === '!n' ? null : value;
                });
                return obj;
            },
            encode: function(obj){
                const pairs = [];
                for (const key in obj) {
                    const value = obj[key];
                    let encodedValue;
                    if (value === true) encodedValue = '!t';
                    else if (value === false) encodedValue = '!f';
                    else if (value === null) encodedValue = '!n';
                    else encodedValue = value;
                    pairs.push(`${key}:${encodedValue}`);
                }
                return `(${pairs.join(',')})`;
            }
        };

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
        navigator.clipboard.writeText(cleanedUrl).then(() => alert('Чистая ссылка скопирована!'));
        console.log('Чистая ссылка:', cleanedUrl);
    })();
})();
