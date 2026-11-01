'use strict';
// 仅原型使用：业务模拟仍由原注册表处理，React 负责公共视觉。
function dispatchPrototypeEvent(type,target){const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});document.dispatchEvent(event);}
window.StackPierUI={
 action(action,data={}){const target=document.createElement('button');for(const [k,v]of Object.entries(data))target.dataset[k]=v;target.dataset.action=action;dispatchPrototypeEvent('click',target);},
 submit(form){dispatchPrototypeEvent('submit',form)},
 closeModal(){closeModal()},closeAsset(){closeAssetDrawer()},
 refresh(){saveInteractionDraft();frpCacheEditor();cacheTemplateDraft();render();if(ui.modal)renderModal();if(assetDrawer)renderAssetDrawer();},
 inventory(){return {pages:navItems.map(n=>({id:n[0],label:n[1]})),modals:Object.keys(prototypeModals),forms:Object.keys(prototypeForms),actions:Object.keys(prototypeActions)};}
};
if(window.AntPrototype){
 const oldRender=render,oldLayout=layout,oldAsset=renderAssetDrawer;
 render=function(...args){const active=document.activeElement,id=active?.id,start=active?.selectionStart,end=active?.selectionEnd;AntPrototype.clear(document.getElementById('app'));const result=oldRender(...args);AntPrototype.upgrade(document.getElementById('app'));restoreFormInputs();syncNavigationAccessibility();if(id){const el=document.getElementById(id);el?.focus({preventScroll:true});try{el?.setSelectionRange(start,end)}catch{}}return result;};
 layout=function(...args){AntPrototype.clear(dialog);const result=oldLayout(...args);AntPrototype.upgrade(dialog,'modal');return result;};
 renderAssetDrawer=function(...args){AntPrototype.clear(assetDialog);const result=oldAsset(...args);if(assetDrawer)AntPrototype.upgrade(assetDialog,'asset');return result;};
 toast=function(text,tone){AntPrototype.feedback(text,tone)};
}
