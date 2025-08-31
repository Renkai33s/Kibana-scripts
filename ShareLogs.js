(function() {
    let hash = window.location.hash;

    if (!hash.includes('_a=')) return;

    const parts = hash.split('&');

    const newParts = parts.map(part => {
        if (part.startsWith('_a=')) {
            let decoded = decodeURIComponent(part.substring(3));

            // ищем savedSearch:'...' и аккуратно убираем
            decoded = decoded.replace(/(^|,)(savedSearch:'[^']*')(,?)/, (match, p1, p2, p3) => {
                // если перед удаляемым элементом была запятая, оставляем только её, если она есть после — тоже убираем
                if (p1 && p3) return ','; // удаляем внутренний элемент, оставляем запятую
                return ''; // иначе просто удаляем
            });

            return '_a=' + encodeURIComponent(decoded);
        }
        return part;
    });

    window.location.hash = newParts.join('&');
})();
