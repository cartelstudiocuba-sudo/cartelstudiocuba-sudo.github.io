// Start after a visible frame; authentication remains an independent gate.
(() => {
 const root=document.documentElement,brand=document.querySelector('.platform-splash-brand');
 let ended=false,timer,frame,startedAt=null,remaining=2200;
 const finish=()=>{if(ended)return;ended=true;clearTimeout(timer);cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);delete root.dataset.splashPending;};
 window.CartelOpening={finish};
 function visibility(){
  if(ended)return;
  if(document.visibilityState==='hidden'){
   cancelAnimationFrame(frame);clearTimeout(timer);
   if(startedAt!==null){remaining=Math.max(0,remaining-(performance.now()-startedAt));startedAt=null;}
   brand?.classList.remove('is-animating');return;
  }
  // The first frame paints the opening surface; the next starts the vector.
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   if(ended||document.visibilityState==='hidden')return;
   brand.classList.add('is-animating');startedAt=performance.now();timer=setTimeout(finish,remaining);
  });});
 }
 if(!brand||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return;}
 document.addEventListener('visibilitychange',visibility);
 visibility();
})();
