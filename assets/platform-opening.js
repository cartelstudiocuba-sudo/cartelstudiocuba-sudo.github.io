// Presentation timing is independent of authorization. Both must finish to reveal the app.
(() => {
 const root=document.documentElement;
 let ended=false,holdTimer,loadTimer;
 const finish=()=>{if(ended)return;ended=true;clearTimeout(holdTimer);clearTimeout(loadTimer);delete root.dataset.splashPending;};
 window.CartelOpening={finish};
 const image=document.querySelector('.platform-splash-brand img');
 if(!image||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return;}
 const start=()=>{if(ended)return;clearTimeout(loadTimer);holdTimer=setTimeout(finish,1600);};
 image.addEventListener('load',start,{once:true});
 image.addEventListener('error',finish,{once:true});
 if(image.complete){if(image.naturalWidth)start();else finish();}
 else loadTimer=setTimeout(finish,3000);
})();
