(function() {
    // Получаем текущий hash (всё после #)
    let hash = window.location.hash;

    if (hash.includes('_a=')) {
        // Находим и декодируем параметр _a
        const hashParts = hash.split('&');
        const newHashParts = hashParts.map(part => {
            if (part.startsWith('_a=')) {
                let value = part.substring(3); // убираем "_a="
                try {
                    let decoded = decodeURIComponent(value);
                    // Убираем savedSearch:'...'
                    decoded = decoded.replace(/,?savedSearch:'[^']*'/, '');
                    return '_a=' + encodeURIComponent(decoded);
                } catch (e) {
                    console.error('Ошибка при декодировании _a:', e);
                    return part;
                }
            }
            return part;
        });

        // Обновляем hash и инициируем переход
        window.location.hash = newHashParts.join('&');
    } else {
        console.log('_a параметр не найден в hash');
    }
})();
