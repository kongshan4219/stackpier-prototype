import React,{useState} from 'react';
import {Alert,Button,Card,Checkbox,Drawer,Empty,Select,Space,Tag} from 'antd';
import {c} from './copy';
export default function DockerInventory({rows,selected,setSelected,locked,onEdit,onDelete}){
 const [container,setContainer]=useState(null),[family,setFamily]=useState('all');
 const groups=Object.groupBy(rows,r=>r.container);
 const shown=(groups[container]||[]).filter(r=>family==='all'||r.family===family);
 const choose=(id,checked)=>setSelected(checked?[...new Set([...selected,id])]:selected.filter(x=>x!==id));
 return <>
 <div className="fw-docker-grid">{Object.entries(groups).map(([name,endpoints])=><Card key={name} title={name} extra={<Button onClick={()=>{setContainer(name);setFamily('all')}}>{c.detail}</Button>}>
 <p>{endpoints.map(r=>`${r.host}:${r.port} → ${r.targetPort}/${r.protocol}`).join(' · ')}</p>
 <Tag color={endpoints.every(r=>r.effective)?'green':'orange'}>{endpoints.every(r=>r.effective)?c.effective:c.ineffective}</Tag>
 </Card>)}</div>{!rows.length&&<Empty description={c.noRules}/>}
 <Drawer open={!!container} title={container} width={720} onClose={()=>setContainer(null)}>
 <Space wrap className="fw-toolbar"><Checkbox disabled={locked} checked={shown.length>0&&shown.every(r=>selected.includes(r.id))} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,...shown.map(r=>r.id)])]:selected.filter(id=>!shown.some(r=>r.id===id)))}>{c.selectAll}</Checkbox>
 <Button disabled={locked||!shown.some(r=>selected.includes(r.id))} onClick={()=>onEdit(shown.filter(r=>selected.includes(r.id)))}>{c.settings}</Button>
 <Button disabled={locked||!shown.some(r=>selected.includes(r.id))} onClick={()=>onDelete(shown.filter(r=>selected.includes(r.id)).map(r=>r.id))}>{c.remove}</Button>
 <Select aria-label={c.family} value={family} onChange={setFamily} options={['all','ipv4','ipv6'].map(value=>({value,label:value==='all'?c.all:value}))}/></Space>
 {shown.map(r=><Card key={r.id} size="small" className="fw-review" title={<Checkbox disabled={locked} checked={selected.includes(r.id)} onChange={e=>choose(r.id,e.target.checked)}>{r.host}:{r.port} → {r.targetPort}/{r.protocol}</Checkbox>} extra={<Button disabled={locked} onClick={()=>onEdit([r])}>{c.settings}</Button>}>
 <p>{c.modes.find(m=>m[0]===r.mode)?.[1]||r.mode} · {r.sources||c.all}</p><Tag color={r.effective?'green':'orange'}>{r.effective?c.effective:c.ineffective}</Tag>{!r.effective&&<Alert type="warning" title={c.orphanHint}/>}</Card>)}
 </Drawer></>;
}
