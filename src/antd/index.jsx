import React,{useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ConfigProvider,Modal,Drawer,App,Button,Select,Space,Spin,Alert,Empty} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {parse} from './convert';
import {productTheme,applyVariables} from './theme';
import {copy} from './copy';
import './product.css';
let barObserver;
const roots=new Map();let mode=localStorage.getItem('stackpier-review-theme')==='dark'?'dark':'light';let scenario='normal';
const motion=matchMedia('(prefers-reduced-motion: reduce)');
function Provider({children}){return <ConfigProvider locale={zhCN} theme={productTheme(mode,motion.matches)}><App>{children}</App></ConfigProvider>}
function ReviewControls(){return <Space wrap><Button aria-label={copy.theme} onClick={()=>{mode=mode==='light'?'dark':'light';localStorage.setItem('stackpier-review-theme',mode);applyVariables(mode,motion.matches);window.StackPierUI.refresh();}}>{mode==='light'?copy.light:copy.dark}</Button><Select aria-label={copy.scenario} value={scenario} options={['normal','loading','empty','error'].map(value=>({value,label:copy[value]}))} onChange={v=>{scenario=v;window.StackPierUI.refresh()}}/></Space>}
function PageState(){if(scenario==='normal')return null;return <section className="review-state">{scenario==='loading'?<Spin tip={copy.loadingText}><div style={{height:130}}/></Spin>:scenario==='error'?<Alert type="error" showIcon title={copy.errorTitle} description={copy.errorDescription} action={<Button onClick={()=>{scenario='normal';window.StackPierUI.refresh()}}>{copy.retry}</Button>}/>:<Empty description={<><strong>{copy.emptyTitle}</strong><p>{copy.emptyDescription}</p></>}/>}<Button onClick={()=>{scenario='normal';window.StackPierUI.refresh()}}>{copy.recover}</Button></section>}
function mount(el,content){release(el);const root=createRoot(el);roots.set(el,root);flushSync(()=>root.render(<Provider>{content}</Provider>));}
function release(el){const root=roots.get(el);if(root){flushSync(()=>root.unmount());roots.delete(el)}}
function upgrade(el,kind='page'){const html=el.innerHTML;
 if(kind==='page'){
  const dom=document.createElement('template');dom.innerHTML=html;
  const workbench=dom.content.querySelector('#main');if(workbench&&scenario!=='normal'){workbench.querySelectorAll(':scope > :not(.page-heading)').forEach(n=>n.remove());workbench.insertAdjacentHTML('beforeend','<div id="review-state-root"></div>');}
  mount(el,parse(dom.innerHTML));
  const bar=el.querySelector('.review-controls');if(bar){const host=document.createElement('span');bar.prepend(host);mount(host,<ReviewControls/>)}
  barObserver?.disconnect();const reviewBar=el.querySelector('.review-bar');if(reviewBar){barObserver=new ResizeObserver(()=>document.documentElement.style.setProperty('--review-offset',reviewBar.getBoundingClientRect().height+'px'));barObserver.observe(reviewBar);}
  const state=el.querySelector('#review-state-root');if(state)mount(state,<PageState/>);
 }else{
  const d=document.createElement('template');d.innerHTML=html;const title=d.content.querySelector('h2')?.textContent||copy.product;const subtitle=d.content.querySelector('.dialog-header p')?.textContent;const body=d.content.querySelector('.dialog-body')?.innerHTML||html;const footer=d.content.querySelector('.dialog-footer')?.innerHTML;const form=d.content.querySelector('form');
  const content=<><p className="modal-description">{subtitle}</p>{parse(body)}</>;
  if(kind==='asset')mount(el,<Drawer open getContainer={false} width={720} title={<span id="asset-detail-title">{title}</span>} onClose={()=>window.StackPierUI.closeAsset()} footer={parse(footer||'')} rootClassName="product-drawer">{content}</Drawer>);
  else mount(el,<Modal open getContainer={false} title={<h2 id="dialog-title">{title}</h2>} width={el.classList.contains('wide')?960:640} onCancel={()=>window.StackPierUI.closeModal()} footer={parse(footer||'')} destroyOnHidden modalRender={node=>form?<form data-form={form.dataset.form} className="product-modal-form" onSubmit={e=>{e.preventDefault();e.stopPropagation();window.StackPierUI.submit(e.currentTarget,e)}}>{node}</form>:node} styles={{body:{maxHeight:'65dvh',overflowY:'auto',paddingRight:8}}}>{content}</Modal>);
 }
}
function clear(el){for(const [host]of roots)if(host!==el&&el.contains(host))release(host);release(el)}
function Feedback({text,tone}){const {message}=App.useApp();useEffect(()=>{message.open({content:text,type:['error','warning'].includes(tone)?tone:'success',duration:5.2});return ()=>message.destroy();},[text,tone]);return null;}
function feedback(text,tone){mount(document.getElementById('toasts'),<Feedback text={text} tone={tone}/>);}
applyVariables(mode,motion.matches);motion.addEventListener('change',()=>{applyVariables(mode,motion.matches);window.StackPierUI?.refresh()});
window.AntPrototype={upgrade,clear,feedback,theme:()=>mode,scenario:()=>scenario,ready:true};

// Native dialog 与 getContainer=false 共用时，显式封闭 Tab 边界。
document.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const container=event.target.closest?.('dialog[open]');if(!container)return;
 const elements=Array.from(container.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')).filter(el=>!el.disabled&&el.tabIndex>=0&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
 const first=elements[0],last=elements.at(-1);
 if(first&&((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last))){event.preventDefault();event.stopImmediatePropagation();(event.shiftKey?last:first).focus();}
},true);
