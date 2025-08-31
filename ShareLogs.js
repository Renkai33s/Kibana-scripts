(function() {

  // --- Полноценный RISON-парсер (из Kibana) ---
  const rison = (function() {
    // Минимальный парсер и энкодер для Kibana RISON
    // Источник: https://github.com/Nanonid/rison
    function isWhitespace(c){ return /\s/.test(c); }
    function parseRison(str) {
      let i=0;
      function error(msg){ throw new Error(msg+" at pos "+i); }
      function peek(){ return str[i]; }
      function next(){ return str[i++]; }
      function parseValue() {
        let c = peek();
        if(c==='(') return parseObject();
        if(c==='!') { next(); let n = peek(); if(n==='t'){next(); return true;} if(n==='f'){next(); return false;} if(n==='n'){next(); return null;} if(n==='(') return parseArray(); error('Unexpected !');}
        if(c==="'" || c==='"') return parseString();
        return parseLiteral();
      }
      function parseObject() {
        let obj={}; next(); // skip '('
        if(peek()===')'){next(); return obj;}
        while(true){
          let key = parseKey();
          if(next() !== ':') error('Expected ":"');
          let val = parseValue();
          obj[key] = val;
          let p = peek();
          if(p===')'){next(); break;}
          if(p!==',') error('Expected "," or ")"'); next();
        }
        return obj;
      }
      function parseArray() {
        let arr=[]; // !(
        if(next()!=='(') error('Expected "("');
        if(peek()===')'){next(); return arr;}
        while(true){ arr.push(parseValue()); let p=peek(); if(p===')'){next(); break;} if(p!==',') error('Expected "," or ")"'); next(); }
        return arr;
      }
      function parseString() {
        let quote = next(); let s=''; while(true){ let c=next(); if(c===quote) break; s+=c; } return s;
      }
      function parseLiteral() {
        let s='';
        while(i<str.length && /[^\s,)\]]/.test(peek())) s+=next();
        if(/^\d+$/.test(s)) return parseInt(s,10);
        if(/^\d+\.\d+$/.test(s)) return parseFloat(s);
        return s;
      }
      function parseKey() {
        let s=''; while(i<str.length && /[A-Za-z0-9_]/.test(peek())) s+=next();
        if(!s) error('Invalid key');
        return s;
      }
      return parseValue();
    }
    function encode(obj){
      if(obj===null) return '!n';
      if(obj===true) return '!t';
      if(obj===false) return '!f';
      if(Array.isArray(obj)) return '!('+obj.map(encode).join(',')+')';
      if(typeof obj==='object') return '('+Object.entries(obj).map(([k,v])=>k+':'+encode(v)).join(',')+')';
      if(typeof obj==='string'){
        if(/^[A-Za-z0-9_]+$/.test(obj)) return obj;
        return "'"+obj+"'";
      }
      return String(obj);
    }
    return { decode: parseRison, encode };
  })();

  // --- Уведомления ---
  if (!window.__notifContainer) {
    const container = document.createElement("div");
    container.id = "notif-container";
    container.style.position = "fixed";
    container.style.bottom = "20px";
    container.style.right = "20px";
    container.style.width = "auto";
    container.style.zIndex = 999999;
    document.body.appendChild(container);
    window.__notifContainer = container;
    window.__currentNotif = null;
  }

  function showMessage(msg, isError=false, isSuccess=false){
    if(window.__currentNotif){ window.__currentNotif.remove(); window.__currentNotif=null; }
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = isError?"#ff4d4f":isSuccess?"#52c41a":"#3498db";
    div.style.color="white";
    div.style.fontFamily="sans-serif";
    div.style.fontSize="14px";
    div.style.minWidth="120px";
    div.style.textAlign="center";
    div.style.boxShadow="0 2px 6px rgba(0,0,0,0.2)";
    window.__notifContainer.appendChild(div);
    window.__currentNotif=div;
    setTimeout(()=>{ if(window.__currentNotif===div){ div.remove(); window.__currentNotif=null; } },2000);
  }

  function showError(msg){ showMessage(msg,true,false); }
  function showSuccess(msg){ showMessage(msg,false,true); }

  // --- Удаление savedSearch рекурсивно ---
  function removeSavedSearch(obj){
    if(typeof obj !== 'object' || !obj) return;
    if('savedSearch' in obj) delete obj.savedSearch;
    Object.values(obj).forEach(removeSavedSearch);
  }

  // --- Основная логика ---
  try {
    let url = window.location.href;
    let [base, query] = url.split('?');
    if(!query) throw new Error("Нет параметров URL");

    // Парсим параметры
    let params = {};
    query.split('&').forEach(p => { let [k,v] = p.split('='); params[k] = decodeURIComponent(v || ''); });

    // Обрабатываем _a
    if(params['_a']){
      let aObj = rison.decode(params['_a']);
      removeSavedSearch(aObj);
      params['_a'] = rison.encode(aObj);
    }

    // Обрабатываем _q (если есть)
    if(params['_q']){
      let qObj = rison.decode(params['_q']);
      removeSavedSearch(qObj);
      params['_q'] = rison.encode(qObj);
    }

    // Собираем новый URL
    let newQuery = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    let cleanUrl = `${base}?${newQuery}`;

    showSuccess("Перезагружаю Kibana без savedSearch...");
    window.location.replace(cleanUrl);

  } catch(e){
    showError("Ошибка: "+e.message);
  }

})();
