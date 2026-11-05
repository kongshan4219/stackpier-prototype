import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Dialog,Toast} from 'radix-ui';
import {Cross2Icon} from '@radix-ui/react-icons';
import {Button} from '@design/ui';
import Shell from './shell';
import {FragmentView} from './fragments';
import {copy} from './copy';

const roots=new Map();
let mode=localStorage.getItem('stackpier-review-theme')==='dark'?'dark':'light';
function theme(value){mode=value;document.documentElement.dataset.theme=value;localStorage.setItem('stackpier-review-theme',value);window.StackPierUI?.refresh();}
document.documentElement.dataset.theme=mode;
function mount(host,node){let root=roots.get(host);if(!root){root=createRoot(host);roots.set(host,root)}flushSync(()=>root.render(node));}
function clear(host){const root=roots.get(host);if(root){flushSync(()=>root.unmount());roots.delete(host)}host.replaceChildren();}
function Modal({host,title,subtitle,body,foot,wide,form,asset=false,restoreFocus}) {
  const close=()=>asset?window.StackPierUI.closeAsset():window.StackPierUI.closeModal();
  const content=<><header className="dialog-header"><div><Dialog.Title asChild><h2 id={asset?'asset-detail-title':'dialog-title'}>{title}</h2></Dialog.Title><Dialog.Description>{subtitle||copy.simulation}</Dialog.Description></div><Button variant="ghost" size="icon" aria-label={copy.close} onClick={close}><Cross2Icon/></Button></header><FragmentView className="dialog-body" html={body}/><FragmentView as="footer" className="dialog-footer" html={foot}/></>;
  return <Dialog.Root open onOpenChange={open=>!open&&close()}><Dialog.Overlay className="modal-overlay"/>
    <Dialog.Content className={`modal-content ${wide?'wide':''} ${asset?'asset-sheet':''} ${form==='templateedit'?'configuration-sheet':''}`} onInteractOutside={e=>e.preventDefault()} onCloseAutoFocus={e=>{e.preventDefault();requestAnimationFrame(()=>{if(!host.open)restoreFocus?.focus({preventScroll:true})})}}>
      {form?<form className="dialog-layout" data-form={form} onSubmit={e=>{e.preventDefault();e.stopPropagation();window.StackPierUI.submit(e.currentTarget)}}>{content}</form>:<div className="dialog-layout">{content}</div>}
    </Dialog.Content></Dialog.Root>;
}
function Feedback({text,tone}) {return <Toast.Provider duration={5200}><Toast.Root defaultOpen className={`toast ${tone}`}><Toast.Description>{text}</Toast.Description><Toast.Close asChild><Button size="icon" variant="ghost" aria-label={copy.close}><Cross2Icon/></Button></Toast.Close></Toast.Root><Toast.Viewport className="toast-viewport"/></Toast.Provider>;}
window.RadixPrototype={
  ready:true,
  render(view){mount(document.getElementById('app'),<Shell view={view} mode={mode} setMode={theme}/>);},
  modal(host,props){host.open=true;mount(host,<Modal host={host} {...props}/>);},
  clear,
  feedback(text,tone){mount(document.getElementById('toasts'),<Feedback key={Date.now()} text={text} tone={tone}/>);},
};
