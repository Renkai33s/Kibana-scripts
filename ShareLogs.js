(function() {
    let hash = window.location.hash;
    if (!hash.includes('_a=')) return;

    const parts = hash.split('&');

    const newParts = parts.map(part => {
        if (part.startsWith('_a=')) {
            let decoded = decodeURIComponent(part.substring(3));

            // находим блок discover:(...)
            decoded = decoded.replace(/discover:\((.*?)\)/, (match, inner) => {
                // удаляем только savedSearch:'...' внутри discover
                const newInner = inner.replace(/,?savedSearch:'[^']*'/, '');
                return 'discover:(' + newInner + ')';
            });

            return '_a=' + encodeURIComponent(decoded);
        }
        return part;
    });

    window.location.hash = newParts.join('&');
})();
