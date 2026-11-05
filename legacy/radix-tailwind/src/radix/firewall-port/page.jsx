import React,{useRef,useState} from 'react';
import {Alert,Button,Card,Checkbox,Collapse,Drawer,Empty,Form,Input,Modal,Select,Space,Switch,Table,Tabs,Tag,Typography} from '../controls';
import {c,serverNames} from './copy';
import {seed,options,exported} from './model';
import {Editor,ImportDialog,ConfirmDialog} from './dialogs';
import DockerInventory from './docker';
const providers=['firewalld','ufw','iptables','nftables'];
export default function FirewallPort(){
 const [server,setServer]=useState('alpha');
 const [hosts,setHosts]=useState(()=>({alpha:seed(),beta:seed('ufw')}));
 return <section className="fw-port"><Typography.Title level={2}>{c.title}</Typography.Title><p>{c.intro}</p><Alert type="info" showIcon title={c.simulation} description={c.source}/>
 <Space wrap className="fw-toolbar"><label htmlFor="port-server">{c.server}</label><Select id="port-server" aria-label={c.server} value={server} onChange={setServer} options={Object.entries(serverNames).map(([value,label])=>({value,label}))}/><a href="?legacy=1#firewall">{c.legacy}</a></Space>
 <Screen key={server} server={server} host={hosts[server]} update={fn=>setHosts(old=>({...old,[server]:fn(old[server])}))}/></section>;
}
function Screen({server,host,update}){
 const [tab,setTab]=useState('system'),[scene,setScene]=useState('normal'),[outcome,setOutcome]=useState('success'),[q,setQ]=useState(''),[family,setFamily]=useState('all'),[action,setAction]=useState('all'),[selected,setSelected]=useState([]),[dialog,setDialog]=useState(null),[request,setRequest]=useState(null),[info,setInfo]=useState(null),[review,setReview]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0);
 const [narrow,setNarrow]=useState(()=>innerWidth<600);
 React.useEffect(()=>{const resize=()=>setNarrow(innerWidth<600);addEventListener('resize',resize);return ()=>removeEventListener('resize',resize)},[]);
 const field=tab==='system'?'rules':tab;
 const backend=tab==='docker'?host.dockerBackend:tab==='forwarding'?host.forwardBackend:host.provider;
 const busy=host.tasks.some(t=>['queued','unknown'].includes(t.state));
 const locked=['read-failed','uninstalled','conflict','readonly'].includes(scene)||busy;
 const lifecycleState=host.lifecycle[tab]||host.lifecycle.system;
 const active=scene!=='stopped'&&lifecycleState.active;
 const source=scene==='empty'?[]:(host[field]||[]);
 const rows=source.filter(r=>(family==='all'||r.family===family)&&(action==='all'||r.action===action)&&JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
 const label=key=>c[key]||key;
 function ask(operation,labelText,apply,summary=''){
  setError('');setRequest({provider:backend,action:operation,label:labelText,apply,summary,server:serverNames[server],revision:host.revision});
 }
 function complete(extra){
  const req=request;if(!req)return;
  if(req.revision!==host.revision){setError(c.errors.stale);setRequest(null);return}
  const id=`${server}-${Date.now()}-${sequence.current++}`,chosen=outcome;
  update(h=>({...h,tasks:[{id,label:req.label,state:'queued',server:serverNames[server],details:req.summary,...extra},...h.tasks]}));setRequest(null);setDialog(null);setSelected([]);
  // 仅浏览器状态演示，不调 API；切换服务器不重定向此任务。
  setTimeout(()=>update(h=>{
   let next=h;
   if(chosen==='success')next=req.apply(h,extra);
   else if(chosen==='partial'&&req.partial)next=req.partial(h,extra);
   return {...next,revision:next.revision+1,tasks:next.tasks.map(t=>t.id===id?{...t,state:chosen,results:(req.items||[req.summary]).map((item,index)=>({item,state:chosen==='partial'?(index<Math.max(1,Math.floor((req.items?.length||1)/2))?'success':'failed'):chosen})),error:chosen==='failed'?'simulated command failure':chosen==='unknown'?'simulated response loss':undefined}:t)};
  }),600);
 }
 function save(kind,items){
  const key=kind==='system'?'rules':kind;
  const old=dialog?.row;
  if(kind==='docker'&&dialog?.batch){const ids=dialog.batch.map(r=>r.id);const policy=items[0];ask('save',c.settings,h=>({...h,docker:h.docker.map(r=>ids.includes(r.id)?{...r,mode:policy.mode,sources:policy.sources}:r)}),`${ids.length}`);return}
  const actionName=old?.id?c.edit:c.create;
  const without=host[key].filter(r=>r.id!==old?.id);
  const compare=r=>JSON.stringify(kind==='system'?[r.protocol,r.sourceAddress,r.destinationPort,r.action]:kind==='forwarding'?[r.family,r.protocol,r.port,r.targetIP,r.targetPort,r.interface]:[r.port,r.protocol,r.sources,r.mode]);
  if(items.some(item=>without.some(r=>compare(r)===compare(item)))){setError(c.errors.duplicate);return}
  const added=items.map((r,i)=>({...r,id:old?.id||`new-${Date.now()}-${i}`}));
  ask('save',actionName,h=>({...h,[key]:[...h[key].filter(r=>r.id!==old?.id),...added]}),`${c.tabs.find(t=>t[0]===kind)?.[1]||c.whitelist} · ${items.length}`);
  setRequest(r=>({...r,items:added.map(item=>({...item})),partial:h=>({...h,[key]:[...h[key].filter(r=>r.id!==old?.id),...added.slice(0,Math.max(1,Math.floor(added.length/2)))]})}));
 }
 function remove(kind,ids){const key=kind==='system'?'rules':kind;if(host[key].some(r=>ids.includes(r.id)&&r.protected)){setError(c.errors.protected);return}ask('delete',c.remove,h=>({...h,[key]:h[key].filter(r=>!ids.includes(r.id))}),`${ids.length}`)}
 function lifecycle(operation){
  ask(operation,label(operation),(h,opts)=>{
   if(operation==='reset'){const backup={id:`backup-${Date.now()}`,name:`${tab}-${new Date().toISOString()}.json`,kind:tab,rows:structuredClone(h[field]||[])};return {...h,[field]:[],lifecycle:{...h.lifecycle,[tab]:{active:false,bound:false}},backups:opts.backup?[backup,...h.backups]:h.backups}}
   const restored=h.backups.find(b=>b.id===opts.restore&&b.kind===tab);
   return {...h,...(restored?{[field]:structuredClone(restored.rows)}:{}),lifecycle:{...h.lifecycle,[tab]:{active:operation!=='stop',bound:operation!=='unbind'}}};
  },`${backend} · ${c.tabs.find(t=>t[0]===tab)?.[1]}`);
 }
 function download(){const list=selected.length?source.filter(r=>selected.includes(r.id)):rows;const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(exported(tab,list,backend),null,2)],{type:'application/json'}));a.href=url;a.download=`${tab}-rules.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 const operations={title:c.operations,key:'ops',fixed:narrow?undefined:'right',width:180,render:(_,r)=><Space wrap><Button size="small" onClick={()=>setInfo({title:c.detail,row:r})}>{c.detail}</Button><Button size="small" disabled={locked||r.opaque} onClick={()=>setDialog({kind:tab,row:r})}>{c.edit}</Button><Button size="small" danger disabled={locked||r.protected} onClick={()=>remove(tab,[r.id])}>{c.remove}</Button></Space>};
 const systemCols=[{title:c.protocol,dataIndex:'protocol',width:90},{title:c.sourceIP,dataIndex:'sourceAddress',width:170,render:v=>v||'*'},{title:c.port,dataIndex:'destinationPort',width:110,render:v=>v||'*'},{title:c.family,dataIndex:'family',width:90},{title:c.action,dataIndex:'action',width:100,render:v=><Tag color={v==='accept'?'green':'red'}>{c[v]||v}</Tag>},{title:c.priority,dataIndex:'priority',width:100},{title:c.description,dataIndex:'description',width:190,render:(v,r)=><>{v}{r.protected&&<Tag>{c.protected}</Tag>}{r.opaque&&<Tag>{c.opaque}</Tag>}</>},operations];
 const forwardCols=['family','protocol','port','targetIP','targetPort','interface'].map(k=>({title:c.fields[k],dataIndex:k,width:130})).concat(operations);
 return <>
 <Collapse className="fw-review" items={[{key:'review',label:c.reviewTools,children:<Space wrap><label>{c.scenario}<Select aria-label={c.scenario} value={scene} options={options(c.scenes)} onChange={v=>{setScene(v);setSelected([])}}/></label><label>{c.outcome}<Select aria-label={c.outcome} value={outcome} options={options(c.outcomes)} onChange={setOutcome}/></label><Button onClick={()=>setReview(true)}>{c.review}</Button></Space>}]}/>
 <Tabs activeKey={tab} onChange={v=>{setTab(v);setSelected([]);setQ('');setFamily('all');setAction('all');setError('')}} items={c.tabs.map(([key,label])=>({key,label}))}/>
 {error&&<Alert role="alert" type="error" title={error} closable onClose={()=>setError('')}/>}
 {scene!=='normal'&&<Alert showIcon type={['read-failed','conflict'].includes(scene)?'error':'warning'} title={c.sceneText[scene]}/>}
 {tab!=='settings'?<>
 <Card size="small"><Space wrap><Tag color="blue">{backend}</Tag><Tag color={active?'green':'orange'}>{active?(['firewalld','ufw'].includes(backend)?c.running:lifecycleState.bound?c.bound:c.unbound):c.stopped}</Tag><Tag>IPv4</Tag><Tag color={scene==='ipv6-failed'?'orange':undefined}>IPv6 · {host.ipv6?(scene==='ipv6-failed'?c.unavailable:c.read):c.disabled}</Tag>
 {(['firewalld','ufw'].includes(backend)?[active?'stop':'start','restart']:['initialize',lifecycleState.bound?'unbind':'bind','repair']).map(op=><Button key={op} disabled={locked} onClick={()=>lifecycle(op)}>{label(op)}</Button>)}
 <Button danger disabled={locked} onClick={()=>lifecycle('reset')}>{c.reset}</Button></Space><p className="fw-muted">{c.statusHint}</p></Card>
 <Space wrap className="fw-toolbar">
 {tab!=='docker'&&<Button type="primary" disabled={locked} onClick={()=>setDialog({kind:tab})}>{c.create}</Button>}
 <Button disabled={locked||!selected.length} danger onClick={()=>remove(tab,selected)}>{c.batch}</Button>
 <Button disabled={locked} onClick={()=>setDialog({kind:'import',target:tab})}>{c.import}</Button><Button onClick={download} disabled={!rows.length}>{c.export}</Button>
 <Button onClick={()=>{setSelected([]);setScene('normal')}}>{c.refresh}</Button>
 <Input aria-label={c.search} placeholder={c.search} value={q} onChange={e=>{setQ(e.target.value);setSelected([])}}/>
 <Select aria-label={c.family} value={family} onChange={v=>{setFamily(v);setSelected([])}} options={options([['all',c.all],['ipv4','IPv4'],['ipv6','IPv6']])}/>
 {tab==='system'&&<Select aria-label={c.action} value={action} onChange={v=>{setAction(v);setSelected([])}} options={options([['all',c.all],['accept',c.accept],['drop',c.drop],['reject',c.reject]])}/>}
 </Space>
 {tab==='system'&&<p className="fw-muted">{backend==='firewalld'?c.publicScope:backend==='ufw'?'incoming · IPv4 / IPv6':c.basicScope}</p>}
 {tab==='docker'?<DockerInventory rows={rows} selected={selected} setSelected={setSelected} locked={locked} onEdit={batch=>setDialog({kind:'docker',row:batch[0],batch})} onDelete={ids=>remove('docker',ids)}/>:<Table rowKey="id" size="middle" dataSource={rows} columns={tab==='system'?systemCols:forwardCols} scroll={{x:1050}} pagination={{pageSize:10,showSizeChanger:false}} locale={{emptyText:<Empty description={c.noRules}/>}} rowSelection={{selectedRowKeys:selected,onChange:setSelected,getCheckboxProps:r=>({disabled:locked||r.protected})}}/>}
 </>:<Card><Alert type="info" title={c.backendHint}/><Form layout="vertical" className="fw-settings">
 {['system','forwarding','docker'].map(kind=>{const key=kind==='system'?'provider':kind==='forwarding'?'forwardBackend':'dockerBackend';return <Form.Item key={kind} label={c.tabs.find(t=>t[0]===kind)[1]+' · '+c.backend}><Select aria-label={kind+' '+c.backend} value={host[key]} disabled={locked} options={(kind==='system'?providers:['iptables','nftables']).map(value=>({value,label:value}))} onChange={value=>ask('select',c.backend,h=>({...h,[key]:value}),`${host[key]} → ${value}`)}/></Form.Item>})}
 <Form.Item label={c.ipv6}><Switch aria-label={c.ipv6} checked={host.ipv6} disabled={locked} onChange={value=>ask('ipv6',c.ipv6,h=>({...h,ipv6:value}),String(value))}/></Form.Item>
 <Form.Item label={c.ping}><Switch aria-label={c.ping} checked={host.ping} disabled={locked} onChange={value=>ask('ping',c.ping,h=>({...h,ping:value}),String(value))}/></Form.Item>
 <Form.Item label={c.whitelist}><Button disabled={locked} onClick={()=>setDialog({kind:'whitelist'})}>{c.create}</Button><p>{c.portWhitelistHint}</p><Table rowKey="id" size="small" pagination={false} dataSource={host.whitelist} scroll={{x:500}} columns={['type','protocol','port','sources'].map(k=>({title:c.fields[k],dataIndex:k})).concat({title:c.operations,render:(_,r)=><Space><Button disabled={locked} onClick={()=>setDialog({kind:'whitelist',row:r})}>{c.edit}</Button><Button disabled={locked} onClick={()=>remove('whitelist',[r.id])}>{c.remove}</Button></Space>})}/></Form.Item>
 </Form></Card>}
 <Collapse className="fw-review" items={[{key:'tasks',label:`${c.task} · ${host.tasks.length}`,children:host.tasks.length?<Space direction="vertical" style={{width:'100%'}}>{host.tasks.map(t=><Card key={t.id} size="small"><Space wrap><strong>{t.label}</strong><Tag color={t.state==='success'?'green':t.state==='queued'?'blue':'orange'}>{c.result[t.state]}</Tag><Button onClick={()=>setInfo({title:c.taskDetail,row:t,taskId:t.id})}>{c.detail}</Button>{t.state==='unknown'&&<Button onClick={()=>ask('verify',c.verify,h=>({...h,tasks:h.tasks.map(x=>x.id===t.id?{...x,state:'failed',details:x.details+c.verifyResult}:x)}),t.id)}>{c.verify}</Button>}</Space></Card>)}</Space>:<Empty description={c.noRules}/>} ]}/>
 {dialog?.kind==='import'&&<ImportDialog kind={dialog.target} provider={backend} onClose={()=>setDialog(null)} onSave={items=>save(dialog.target,items)}/>}
 {dialog&&dialog.kind!=='import'&&<Editor key={dialog.kind+dialog.row?.id} kind={dialog.kind} row={dialog.row} provider={backend} mixedFamily={dialog.batch&&new Set(dialog.batch.map(r=>r.family)).size>1} onClose={()=>setDialog(null)} onSave={items=>save(dialog.kind,items)}/>}
 {request&&<ConfirmDialog key={request.action+request.summary} request={request} backups={host.backups.filter(b=>b.kind===tab)} onClose={()=>setRequest(null)} onConfirm={complete}/>}
 {info&&<Drawer open title={info.title} width={600} onClose={()=>setInfo(null)}><pre className="fw-json">{JSON.stringify(host.tasks.find(t=>t.id===info.taskId)||info.row,null,2)}</pre></Drawer>}
 <Drawer open={review} width={720} title={c.review} onClose={()=>setReview(false)}><Alert type="warning" title={c.pending}/>{c.decisions.map(([title,upstream,stackpier])=><Card key={title} title={title} size="small" className="fw-review"><p><strong>1Panel：</strong>{upstream}</p><p><strong>StackPier：</strong>{stackpier}</p></Card>)}</Drawer>
 </>;
}
