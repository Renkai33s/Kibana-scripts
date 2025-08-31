(function() {
    let hash = window.location.hash;
    if (!hash.includes('savedSearch:')) return;

    // удаляем любой savedSearch:'...'
    const newHash = hash.replace(/,savedSearch:'[^']*'/g, '');
    window.location.hash = newHash;
})();
