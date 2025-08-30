(function() {
  /**
   * Показать всплывающее сообщение
   * @param {string} msg - текст сообщения
   * @param {boolean} isError - ошибка?
   * @param {boolean} isSuccess - успех?
   */
  function showMessage(msg, isError = false, isSuccess = false) {
    const div = document.createElement('div');
    div.textContent = msg;
    div.style.position = 'fixed';
    div.style.bottom = '20px';
    div.style.right = '20px';
    div.style.padding = '10px 15px';
    div.style.borderRadius = '8px';
    // Изменили цвет по умолчанию на красный для "Логи не выделены"
    div.style.background = isError ? '#ff4d4f' : isSuccess ? '#52c41a' : '#ff4d4f';
    div.style.color = 'white';
    div.style.fontFamily = 'sans-serif';
    div.style.fontSize = '14px';
    div.style.zIndex = 999999;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  }

  // Получаем выделенный текст
  const sel = window.getSelection().toString().trim();
  if (!sel) {
    showMessage('Логи не выделены', true); // теперь передаём true, чтобы явно красный
    return;
  }

  // Разбиваем выделение на строки
  const lines = sel.split('\n').map(l => l.trim()).filter(Boolean);

  // Регулярка для поиска строки с датой (начало блока)
  const dateRe = /^[A-Z][a-z]{2} \d{1,2}, \d{4} @/;

  // "Шумовые" строки, которые нужно выбросить
  const noiseRe = /^(INFO|DEBUG|WARN|WARNING|ERROR|TRACE|-|–|—)$/i;

  const blocks = [];
  let current = [];

  const push = () => {
    if (current.length) {
      const cleaned = current.filter(l => !noiseRe.test(l));
      if (cleaned.length) {
        blocks.push(cleaned.join('   ')); // соединяем через 3 пробела
      }
      current = [];
    }
  };

  // Группировка строк по блокам (разделитель — дата)
  for (const line of lines) {
    if (dateRe.test(line)) {
      push();
      current.push(line);
    } else {
      current.push(line);
    }
  }
  push();

  // Финальный результат
  const out = blocks.join('\n');

  // Копируем в буфер
  navigator.clipboard.writeText(out)
    .then(() => showMessage('Логи скопированы', false, true))
    .catch(() => showMessage('Что-то пошло не так', true));
})();
