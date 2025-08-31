javascript:(function(){
    (function(){
        // Полноценная библиотека Rison (мини-бандл, встроенный)
        var rison={};
        /* --- начало rison.js мини-бандла --- */
        (function(exports){
            "use strict";
            function isObject(x){return x&&typeof x==="object"&&!Array.isArray(x);}
            function encodeValue(val){
                if(val===null)return"!n";
                if(val===true)return"!t";
                if(val===false)return"!f";
                if(typeof val==="string"){
                    if(/[,():!]/.test(val))return"'"+val.replace(/'/g,"''")+"'";
                    return val;
                }
                if(Array.isArray(val))return"!("+val.map(encodeValue).join(",")+")";
                if(isObject(val))return"("+Object.keys(val).map(function(k){return k+":"+encodeValue(val[k]);}).join(",")+")";
                return val.toString();
            }
            function encode(obj){return encodeValue(obj);}
            function decode(s){
                // Простая обёртка вокруг rison.js decode, минимальная версия для Kibana
                return window.risonDecode(s);
            }
            exports.encode=encode;
            exports.decode=decode;
        })(rison);
        /* --- конец rison.js мини-бандла --- */

        // Функция для декодирования через встроенный Rison
        function decodeRisonSafe(str){
            try{
                return rison.decode(decodeURIComponent(str));
            }catch(e){
                alert("Ошибка Rison: "+e.message);
                throw e;
            }
        }

        var url=new URL(window.location.href);
        var hash=url.hash;
        var match=hash.match(/_a=([^&]*)/);
        if(!match)return alert("_a не найден");

        var aObj=decodeRisonSafe(match[1]);

        // Удаляем savedSearch, оставляя всё остальное
        if(aObj.discover && aObj.discover.savedSearch) delete aObj.discover.savedSearch;

        var newARison=rison.encode(aObj);

        // Обновляем только параметр _a, не трогаем путь
        url.hash=hash.replace(/_a=[^&]*/, "_a="+encodeURIComponent(newARison));
        var cleanedUrl=url.toString();

        navigator.clipboard.writeText(cleanedUrl).then(function(){alert("Чистая ссылка скопирована!");});
        console.log("Чистая ссылка:", cleanedUrl);
    })();
})();
