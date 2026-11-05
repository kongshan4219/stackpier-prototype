import React,{useContext,useId,useRef,useState,useSyncExternalStore} from 'react';
import {Dialog,Checkbox as RadixCheckbox,Switch as RadixSwitch,Tabs as RadixTabs} from 'radix-ui';
import {CheckIcon,Cross2Icon} from '@radix-ui/react-icons';
import {Button as DesignButton,Input as DesignInput,Textarea} from '@design/ui';
import {copy} from './copy';

// 防火墙审阅页的局部组合组件。接口只覆盖该页的需要，不模拟 Ant Design 通用 API。
export function Button({type,htmlType,danger,size,...props}) {return <DesignButton variant={danger?'danger':type==='primary'?'primary':'secondary'} size={size==='small'?'small':'default'} type={htmlType||'button'} {...props}/>;}
export function Input({onPressEnter,autoSize,...props}) {return <DesignInput {...props} onKeyDown={e=>{props.onKeyDown?.(e);if(e.key==='Enter')onPressEnter?.(e)}}/>;}
Input.TextArea=({autoSize,...props})=><Textarea rows={autoSize?.minRows||4} {...props}/>;
export function InputNumber({onChange,...props}){return <Input type="number" {...props} onChange={e=>onChange?.(e.target.value===''?null:Number(e.target.value))}/>;}
export function Select({options=[],value,onChange,...props}) {return <select className="filter" value={value??''} onChange={e=>onChange?.(e.target.value)} {...props}>{options.map(o=><option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}</select>;}
export function Checkbox({children,onChange,checked,indeterminate,...props}) {const id=useId();return <label className="check" htmlFor={id}><RadixCheckbox.Root id={id} className="radix-check" checked={indeterminate?'indeterminate':checked} onCheckedChange={value=>onChange?.({target:{checked:!!value}})} {...props}><RadixCheckbox.Indicator><CheckIcon/></RadixCheckbox.Indicator></RadixCheckbox.Root><span>{children}</span></label>;}
export function Switch({onChange,...props}){return <RadixSwitch.Root className="radix-switch" onCheckedChange={onChange} {...props}><RadixSwitch.Thumb className="radix-switch-thumb"/></RadixSwitch.Root>;}
export function Space({direction,className='',children,wrap,...props}){return <div className={`${direction==='vertical'?'stack':'flex wrap'} ${className}`} {...props}>{children}</div>;}
Space.Compact=({children,...props})=><div className="compact-controls" {...props}>{children}</div>;
export function Tag({children,color}){return <span className={`badge ${['green','success'].includes(color)?'success':color==='red'?'error':color==='orange'?'warning':''}`}>{children}</span>;}
export function Alert({title,description,type='info',closable,onClose,showIcon,...props}){return <div className={`notice ${type}`} role={type==='error'?'alert':'note'} {...props}><div className="grow"><strong>{title}</strong>{description&&<p>{description}</p>}</div>{closable&&<Button aria-label={copy.close} onClick={onClose}><Cross2Icon/></Button>}</div>;}
export function Card({title,extra,children,className='',size}){return <section className={`card ${className}`}>{title&&<header className="card-head"><h3>{title}</h3>{extra}</header>}<div className="card-body">{children}</div></section>;}
export function Empty({description}){return <div className="empty"><p>{description}</p></div>;}
export const Typography={Title:({level=2,children})=>React.createElement(`h${level}`,{},children)};
export function Collapse({items,className=''}){return <div className={className}>{items.map(item=><details className="disclosure" key={item.key}><summary>{item.label}</summary><div className="disclosure-body">{item.children}</div></details>)}</div>;}
export function Tabs({activeKey,onChange,items}){return <RadixTabs.Root value={activeKey} onValueChange={onChange}><RadixTabs.List className="tabs">{items.map(item=><RadixTabs.Trigger key={item.key} value={item.key} className="tab">{item.label}</RadixTabs.Trigger>)}</RadixTabs.List></RadixTabs.Root>;}
function Layer({open,title,children,onClose,footer,extra,width=640,drawer=false,className=''}){
 return <Dialog.Root open={open} onOpenChange={value=>!value&&onClose?.()}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content aria-describedby={undefined} className={`modal-content ${drawer?'asset-sheet':''} ${className}`} style={{'--modal-width':`${width}px`}} onInteractOutside={e=>e.preventDefault()}><div className="dialog-layout"><header className="dialog-header"><Dialog.Title asChild><h2>{title}</h2></Dialog.Title><Space>{extra}<DesignButton variant="ghost" size="icon" aria-label={copy.close} onClick={onClose}><Cross2Icon/></DesignButton></Space></header><div className="dialog-body">{children}</div>{footer&&<footer className="dialog-footer">{footer}</footer>}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Drawer({onClose,rootClassName,...props}){return <Layer {...props} drawer className={rootClassName} onClose={onClose}/>;}
export function Modal({onCancel,onOk,okButtonProps={},okText=copy.confirm,cancelText=copy.cancel,...props}){return <Layer {...props} onClose={onCancel} footer={<><Button onClick={onCancel}>{cancelText}</Button><Button type="primary" {...okButtonProps} onClick={onOk}>{okText}</Button></>}/>;}
export function Upload({children,beforeUpload,accept}){const ref=useRef();return <div><input type="file" ref={ref} hidden accept={accept} onChange={e=>{const file=e.target.files[0];if(file)beforeUpload(file);e.target.value=''}}/><span onClick={()=>ref.current.click()}>{children}</span></div>;}

const FormContext=React.createContext(null);
function createForm(){
 let values={},listeners=new Set();
 return {initialized:false,element:null,get:()=>values,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},setFieldsValue(next){values={...values,...next};listeners.forEach(fn=>fn())},submit(){this.element?.requestSubmit()}};
}
export function Form({form,initialValues={},onFinish,onValuesChange,children,className=''}){
 const [own]=useState(createForm),instance=form||own;
 if(!instance.initialized){instance.initialized=true;instance.setFieldsValue(initialValues)}
 return <FormContext.Provider value={{instance,onValuesChange}}><form className={`stack ${className}`} ref={el=>instance.element=el} onSubmit={e=>{e.preventDefault();e.stopPropagation();onFinish?.(instance.get())}}>{children}</form></FormContext.Provider>;
}
Form.useForm=()=>{const [form]=useState(createForm);return [form]};
Form.useWatch=(key,form)=>useSyncExternalStore(form.subscribe,()=>form.get()[key]);
Form.Item=function Item({name,label,rules=[],children}){
 const context=useContext(FormContext),id=useId();
 const values=useSyncExternalStore(context?.instance.subscribe||(()=>()=>{}),context?.instance.get||(()=>null));
 const child=React.isValidElement(children)?React.cloneElement(children,{
  id:children.props.id||id,...(name&&context?{value:values?.[name]??'',name,required:rules.some(rule=>rule.required),onChange:arg=>{const value=arg?.target?arg.target.value:arg;const changed={[name]:value};context.instance.setFieldsValue(changed);context.onValuesChange?.(changed);children.props.onChange?.(arg)}}:{})
 }):children;
 return <div className="field"><label htmlFor={React.isValidElement(child)?child.props.id:undefined}>{label}</label>{child}</div>;
};

export function Table({dataSource=[],columns=[],rowKey='key',rowSelection,pagination,locale={}}){
 const [page,setPage]=useState(1),size=pagination?.pageSize||10,hasPages=!!pagination,total=Math.max(1,Math.ceil(dataSource.length/size)),current=Math.min(page,total),rows=hasPages?dataSource.slice((current-1)*size,current*size):dataSource;
 const keys=rowSelection?.selectedRowKeys||[],keyOf=r=>typeof rowKey==='function'?rowKey(r):r[rowKey];
 const selectable=rows.filter(r=>!rowSelection?.getCheckboxProps?.(r).disabled),all=selectable.length>0&&selectable.every(r=>keys.includes(keyOf(r)));
 const selectAll=checked=>rowSelection.onChange(checked?[...new Set([...keys,...selectable.map(keyOf)])]:keys.filter(key=>!selectable.some(r=>keyOf(r)===key)));
 return <section className="card"><div className="table-wrap"><table><thead><tr>{rowSelection&&<th><Checkbox aria-label={copy.selectAll} checked={all} onChange={e=>selectAll(e.target.checked)}/></th>}{columns.map((c,i)=><th key={c.key||c.dataIndex||i}>{c.title}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={keyOf(r)??i}>{rowSelection&&<td><Checkbox aria-label={copy.selectRow} {...rowSelection.getCheckboxProps?.(r)} checked={keys.includes(keyOf(r))} onChange={e=>rowSelection.onChange(e.target.checked?[...keys,keyOf(r)]:keys.filter(k=>k!==keyOf(r)))}/></td>}{columns.map((c,j)=><td key={c.key||c.dataIndex||j}>{c.render?c.render(r[c.dataIndex],r):String(r[c.dataIndex]??'')}</td>)}</tr>)}</tbody></table></div>{!rows.length&&(locale.emptyText||<Empty description={copy.emptyTitle}/>)}{hasPages&&total>1&&<div className="table-total"><Button disabled={current<=1} onClick={()=>setPage(current-1)}>{copy.previous}</Button><span>{current} / {total}</span><Button disabled={current>=total} onClick={()=>setPage(current+1)}>{copy.next}</Button></div>}</section>;
}
