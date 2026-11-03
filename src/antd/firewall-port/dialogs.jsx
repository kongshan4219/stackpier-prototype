import React,{useState} from 'react';
import {Alert,Button,Checkbox,Drawer,Form,Input,InputNumber,Modal,Select,Space,Table,Upload} from 'antd';
import {c} from './copy';
import {normalize,parseImport,options} from './model';
function RuleInputs({value='',onChange,disabled=false,single=false,id}){
 const rows=String(value).split('\n');
 const change=(index,text)=>onChange(rows.map((item,i)=>i===index?text:item).join('\n'));
 return <Space direction="vertical" style={{width:'100%'}}>{rows.map((text,index)=><Space.Compact key={index} style={{width:'100%'}}><Input id={index===0?id:undefined} aria-label={index?c.ruleItem+index:undefined} value={text} disabled={disabled} onChange={e=>change(index,e.target.value)} onPressEnter={e=>{e.preventDefault();if(!single&&!disabled)onChange([...rows,''].join('\n'))}}/>{!single&&<Button disabled={disabled||rows.length===1} onClick={()=>onChange(rows.filter((_,i)=>i!==index).join('\n'))}>{c.remove}</Button>}</Space.Compact>)}{!single&&<Button disabled={disabled} onClick={()=>onChange([...rows,''].join('\n'))}>{c.add}</Button>}</Space>;
}
export function Editor({kind,row,provider,mixedFamily=false,onClose,onSave}){
 const [error,setError]=useState('');const [form]=Form.useForm();const protocol=Form.useWatch('protocol',form);const mode=Form.useWatch('mode',form);
 const initial={protocol:'tcp',action:'accept',family:'ipv4',mode:mixedFamily?'deny_all':'deny_sources',interface:'',type:'custom',...row,...(mixedFamily?{mode:'deny_all'}:{})};
 const field=(name,element=<Input/>,required=false)=><Form.Item key={name} name={name} label={c.fields[name]} rules={required?[{required:true,message:c.errors.required}]:[]}>{element}</Form.Item>;
 return <Drawer rootClassName="firewall-port-editor" open width={600} title={row?.id?c.edit:c.create} onClose={onClose} extra={<Button type="primary" onClick={()=>form.submit()}>{c.submit}</Button>}>
  {error&&<Alert type="error" role="alert" title={error}/>}{row?.protected&&<Alert type="info" title={c.protected}/>}
  <Form layout="vertical" form={form} initialValues={initial} onValuesChange={changed=>{if(changed.protocol==='all'&&provider!=='ufw')form.setFieldsValue({destinationPort:''});if(changed.mode==='deny_all')form.setFieldsValue({sources:''})}} onFinish={v=>{try{const result=row?.protected||row?.opaque?[{...row,description:v.description,...(!row.opaque?{priority:v.priority}:{})}]:normalize(kind,{...row,...v},provider,!!row?.id);onSave(result)}catch(e){setError(e.message)}}}>
  {kind==='system'?<>
   {field('action',<Select disabled={row?.protected||row?.opaque} options={options([['accept',c.accept],['drop',c.drop]])}/>)}
   {field('protocol',<Select disabled={row?.protected||row?.opaque} options={options([['tcp','TCP'],['udp','UDP'],...(!row?.id||provider==='ufw'?[['tcp/udp','TCP/UDP']]:[]),['all','ALL']])}/>)}
   {field('sourceAddress',<RuleInputs single={!!row?.id} disabled={row?.protected||row?.opaque}/>)}
   {field('destinationPort',<RuleInputs single={!!row?.id} disabled={row?.protected||row?.opaque||protocol==='all'&&provider!=='ufw'}/>)}
   {field('priority',<InputNumber disabled={row?.opaque} min={provider==='firewalld'?-32768:1} max={provider==='firewalld'?32767:500}/>)}
   {field('description')}
  </>:kind==='forwarding'?<>
   {field('family',<Select options={options([['ipv4','IPv4'],['ipv6','IPv6']])}/>)}
   {field('protocol',<Select options={options([['tcp','TCP'],['udp','UDP'],['tcp/udp','TCP/UDP']])}/>)}
   {field('port',<Input/>,true)}{field('targetIP')}{field('targetPort',<Input/>,true)}
   {field('interface',<Select options={options([['',c.all],['eth0','eth0'],['eth1','eth1']])}/>)}
  </>:kind==='docker'?<>
   <p>{row?.container} · {row?.host}:{row?.port} → {row?.targetPort} / {row?.protocol}</p>
   {mixedFamily&&<Alert type="warning" title={c.mixedFamily}/>}
   {field('mode',<Select options={options(c.modes).map(o=>({...o,disabled:mixedFamily&&o.value!=='deny_all'}))}/>)}
   {mode!=='deny_all'&&field('sources',<Input.TextArea/>,true)}
  </>:<>
   {field('type',<Select options={options([['custom',c.custom],['ssh','SSH'],['panel',c.panel]])}/>)}
   {field('protocol',<Select options={options([['tcp','TCP'],['udp','UDP']])}/>)}{field('port',<Input/>,true)}{field('sources',<Input.TextArea/>)}
  </>}
  <Space><Button onClick={onClose}>{c.cancel}</Button><Button type="primary" htmlType="submit">{c.submit}</Button></Space>
  </Form>
 </Drawer>;
}
export function ImportDialog({kind,provider,onClose,onSave}){
 const [text,setText]=useState(''),[rows,setRows]=useState([]),[keys,setKeys]=useState([]),[error,setError]=useState('');
 const load=value=>{setText(value);try{const parsed=parseImport(kind,value,provider);setRows(parsed.map((r,i)=>({...r,key:i})));setKeys(parsed.map((_,i)=>i));setError('')}catch(e){setRows([]);setKeys([]);setError(e.message)}};
 return <Modal open width={850} title={c.import} onCancel={onClose} onOk={()=>onSave(rows.filter(r=>keys.includes(r.key)).map(({key,...r})=>r))} okText={c.submit} cancelText={c.cancel} okButtonProps={{disabled:!keys.length}}>
 <Alert title={c.importHelp} type="info"/>
 <Upload accept=".json" showUploadList={false} beforeUpload={file=>{if(file.size>(kind==='system'?64*1024*1024:256*1024)){setError(c.errors.size);return false}file.text().then(load);return false}}><Button>{c.import} JSON</Button></Upload>
 <Input.TextArea aria-label="JSON" value={text} onChange={e=>load(e.target.value)} autoSize={{minRows:4,maxRows:7}}/>
 {error&&<Alert role="alert" type="error" title={error}/>}
 <Table size="small" dataSource={rows} rowSelection={{selectedRowKeys:keys,onChange:setKeys}} scroll={{x:650,y:250}} columns={['protocol','sourceAddress','destinationPort','port','targetIP','targetPort','action','description'].filter(k=>rows.some(r=>r[k]!==undefined)).map(k=>({title:c.fields[k]||k,dataIndex:k}))}/>
 </Modal>;
}
export function ConfirmDialog({request,backups,onClose,onConfirm}){
 const [backup,setBackup]=useState(true),[restore,setRestore]=useState(''),[dockerRestart,setDockerRestart]=useState(false),[confirmProvider,setConfirmProvider]=useState('');
 return <Modal open title={request.label} okButtonProps={{disabled:request.action==='reset'&&confirmProvider!==request.provider}} onCancel={onClose} onOk={()=>onConfirm({backup,restore,dockerRestart})} okText={c.confirm} cancelText={c.cancel}>
 <Alert type="warning" title={request.action==='reset'?c.resetHelp:c.confirmHelp}/>
 <p><strong>{c.server}</strong> · {request.server}</p><p>{request.summary}</p>
 {request.action==='reset'&&<Form.Item label={c.confirmProvider+' · '+request.provider}><Input aria-label={c.confirmProvider} value={confirmProvider} onChange={e=>setConfirmProvider(e.target.value)}/></Form.Item>}
 {request.action==='reset'&&<Checkbox checked={backup} onChange={e=>setBackup(e.target.checked)}>{c.backup}</Checkbox>}
 {['initialize','start'].includes(request.action)&&<Form layout="vertical"><Form.Item label={c.restore}><Select aria-label={c.restore} value={restore} onChange={setRestore} options={[{value:'',label:c.backupNone},...backups.map(b=>({value:b.id,label:b.name}))]}/></Form.Item></Form>}
 {['start','stop','restart','reset'].includes(request.action)&&<Checkbox checked={dockerRestart} onChange={e=>setDockerRestart(e.target.checked)}>{c.dockerRestart}</Checkbox>}
 </Modal>;
}
