(function() {
    let hash = window.location.hash;

    if (!hash.includes('_a=')) return;

    // Функция для безопасного удаления savedSearch внутри discover:(...)
    function removeSavedSearch(aParam) {
        try {
            let decoded = decodeURIComponent(aParam);

            // Находим discover:(...) и удаляем savedSearch:'...'
            decoded = decoded.replace(/(discover:\([^\)]*)savedSearch:'[^']*',?/g, '$1');

            return encodeURIComponent(decoded);
        } catch (e) {
            console.error('Ошибка при обработке _a:', e);
            return aParam;
        }
    }

    // Разбиваем hash на части по &
    const parts = hash.split('&');
    const newParts = parts.map(part => {
        if (part.startsWith('_a=')) {
            return '_a=' + removeSavedSearch(part.substring(3));
        }
        return part;
    });

    // Обновляем hash без трогания остальных параметров
    window.location.hash = newParts.join('&');
})();
