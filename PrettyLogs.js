(function(){
  let notifContainer=document.getElementById("notif-container");
  if(!notifContainer){
    notifContainer=document.createElement("div");
    notifContainer.id="notif-container";
    notifContainer.style.position="fixed";
    notifContainer.style.bottom="20px";
    notifContainer.style.right="20px";
    notifContainer.style.width="300px";
    notifContainer.style.height="auto";
    notifContainer.style.pointerEvents="none";
    document.body.appendChild(notifContainer);
  }

  function showMessage(msg,isError=false,isSuccess=false){
    const div=document.createElement("div");
    div.textContent=msg;
    div.style.padding="10px 15px";
    div.style.borderRadius="8px";
    div.style.background=isError?"#ff4d4f":isSuccess?"#52c41a":"#3498db";
    div.style.color="white";
    div.style.fontFamily="sans-serif";
    div.style.fontSize="14px";
    div.style.opacity="0";
    div.style.transform="translateY(30px)";
    div.style.transition="transform 0.3s ease, opacity 0.3s ease";
    div.style.position="absolute";
    div.style.right="0";
    div.style.pointerEvents="auto";

    const notifs=notifContainer.querySelectorAll("div");
    notifs.forEach(n=>{
      const currentY=parseFloat(n.dataset.y||"0");
      const newY=currentY+40;
      n.dataset.y=newY;
      n.style.transform=`translateY(${newY}px)`;
    });

    div.dataset.y="0";
    notifContainer.appendChild(div);

    requestAnimationFrame(()=>{
      div.style.opacity="1";
      div.style.transform="translateY(0)";
    });

    setTimeout(()=>{
      div.style.opacity="0";
      div.style.transform="translateY(-30px)";
      setTimeout(()=>div.remove(),300);
    },2000);
  }

  function showError(msg){ showMessage(msg,true,false); }
  function showSuccess(msg){ showMessage(msg,false,true); }

  const sel=window.getSelection().toString().trim();
  if(!sel){ showError("Логи не выделены"); return; }

  const lines=sel.split("\n").map(l=>l.trim()).filter(Boolean);
  const dateRe=/^[A-Z][a-z]{2} \d{1,2}, \d{4} @/;
  const noiseRe=/^(INFO|DEBUG|WARN|WARNING|ERROR|TRACE|-|–|—)$/i;

  const blocks=[]; let current=[];
  const push=()=>{
    if(current.length){
      const cleaned=current.filter(l=>!noiseRe.test(l));
      if(cleaned.length) blocks.push(cleaned.join("   "));
      current=[];
    }
  };

  for(const line of lines){ if(dateRe.test(line)){push(); current.push(line);} else {current.push(line);} }
  push();

  const out=blocks.join("\n");
  if(!out.trim()){ showError("Логи не выделены"); return; }

  navigator.clipboard.writeText(out)
    .then(()=>showSuccess("Логи скопированы"))
    .catch(()=>showError("Что-то пошло не так"));
})();
