(()=>{
 'use strict';
 const root=document.documentElement;
 let viewport;
 try{
  if(window.parent!==window&&window.parent.location.origin===location.origin&&window.parent.document.documentElement.classList.contains('inventory-admin-home'))viewport=window.parent.matchMedia('(min-width:600px) and (max-width:900px) and (orientation:portrait)');
 }catch{}
 if(!viewport)return;
 const update=()=>root.classList.toggle('inventory-compact-viewport',viewport.matches);
 update();window.addEventListener('resize',update);
 const modalSelector='dialog[open],.modal-backdrop.open,.report-overlay:not([hidden]),.weekly-export-backdrop:not([hidden]),.inventory-suppliers-modal:not([hidden]),#inventory-product-editor:not([hidden])';
 let touch=null;
 document.addEventListener('touchstart',event=>{
  if(!viewport.matches||event.touches.length!==1){touch=null;return;}
  const modal=event.target.closest?.(modalSelector);
  touch=modal?{modal,x:event.touches[0].clientX,y:event.touches[0].clientY}:null;
 },{passive:true});
 document.addEventListener('touchmove',event=>{
  if(!viewport.matches||!touch||!event.cancelable||event.touches.length!==1)return;
  const {clientX:x,clientY:y}=event.touches[0],dy=y-touch.y,dx=x-touch.x;
  touch.x=x;touch.y=y;
  if(!dy||Math.abs(dx)>Math.abs(dy)||!touch.modal.matches(modalSelector))return;
  for(let node=event.target;node&&touch.modal.contains(node);node=node.parentElement){
   if(!/auto|scroll/.test(getComputedStyle(node).overflowY))continue;
   if(dy>0?node.scrollTop>1:node.scrollHeight-node.clientHeight-node.scrollTop>1)return;
  }
  event.preventDefault();
 },{passive:false});
 document.addEventListener('touchend',()=>{touch=null;},{passive:true});
 document.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
})();
