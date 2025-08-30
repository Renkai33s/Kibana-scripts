(function() {
  function createNotification(msg, bgColor = '#ff4d4f') {
    const wrap = document.createElement('div');
    wrap.textContent = msg;
    wrap.style.position = 'fixed';
    wrap.style.bottom = '20px';
    wrap.style.right = '20px';
    wrap.style.padding = '10px 15px';
    wrap.style.borderRadius = '8px';
    wrap.style.background = bgColor;
    wrap.style.color = 'white';
    wrap.style.fontFamily = 'sans-serif';
    wrap.style.fontSize = '14px';
    wrap.style.zIndex = 999999;
    wrap.style.opacity = '0';
    wrap.style.transform = 'translateY(20px)';
    wrap.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    document.body.appendChild(wrap);

    wrap.offsetHeight; // форсируем первый рендер

    wrap.style.opacity = '1';
    wrap.style.transform = 'translateY(0)';

    setTimeout(() => {
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(20px)';
      wrap.addEventListener('transitionend', () => wrap.remove());
    }, 2000);
  }

  function showMessage(msg, isError = false, isSuccess = false) {
    const bg = isError ? '#ff4d4f' : isSuccess ? '#52c41a' : '#3498db';
    createNotification(msg, bg);
  }

  const sel = window.getSelection().toString().trim();
  if (!sel) {
    showMessage('Логи не выделены', true);
    return;
  }

  const lines = sel.split('\n').map(l => l.trim()).filter(Boolean);
  const dateRe = /^[A-Z][a-z]{2} \d{1,2}, \d{4} @/;
  const noiseRe = /^(INFO|DEBUG|WARN|WARNING|ERROR|TRACE|-|–|—)$/i;

  const blocks = [];
  let current = [];

  const push = () => {
    if (current.length) {
      const cleaned = current.filter(l => !noiseRe.test(l));
      if (cleaned.length) blocks.push(cleaned.join('   '));
      current = [];
    }
  };

  for (const line of lines) {
    if (dateRe.test(line)) {
      push();
      current.push(line);
    } else {
      current.push(line);
    }
  }
  push();

  const out = blocks.join('\n');

  navigator.clipboard.writeText(out)
    .then(() => showMessage('Логи скопированы', false, true))
    .catch(() => showMessage('Что-то пошло не так', true));
})();
