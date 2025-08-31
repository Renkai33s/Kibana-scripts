javascript:(function(){
    try {
        // Получаем текущий URL
        let url = window.location.href;

        // Разделяем на base и query
        let [base, query] = url.split('?');
        if(!query) return;

        // Парсим параметры
        let params = {};
        query.split('&').forEach(p => {
            let [k,v] = p.split('=');
            params[k] = decodeURIComponent(v);
        });

        // Если есть _a, убираем savedSearch
        if(params['_a']){
            params['_a'] = params['_a'].replace(/savedSearch:'[^']*',?/,'');
            params['_a'] = encodeURIComponent(params['_a']);
        }

        // Собираем новый URL
        let newQuery = Object.entries(params).map(([k,v]) => `${k}=${v}`).join('&');
        let newUrl = `${base}?${newQuery}`;

        // Перезаписываем window.location
        window.location.href = newUrl;
    } catch(e){
        alert('Ошибка: '+e.message);
    }
})();
