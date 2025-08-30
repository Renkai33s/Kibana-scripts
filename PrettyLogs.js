(function(){

  // --- Универсальный контейнер уведомлений ---
  let notifContainer = document.getElementById("notif-container");
  if (!notifContainer) {
    notifContainer = document.createElement("div");
    notifContainer.id = "notif-container";
    notifContainer.style.position = "fixed";
    notifContainer.style.bottom = "20px";
    notifContainer.style.right = "20px";
    notifContainer.style.width = "300px";
    notifContainer.style.zIndex = 999999;
    document.body.appendChild(notifContainer);
  }

  const notifications = [];
  const gap = 10;

  function updatePositions() {
    let currentBottom = 0;
    for (let i = notifications.length - 1; i >= 0; i--) {
      const notif = notifications[i];
      notif.style.bottom = currentBottom + 'px';
      currentBottom += notif.offsetHeight + gap;
    }
  }

  function showMessage(msg, isError=false, isSuccess=false, duration=2000){
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.background = is
