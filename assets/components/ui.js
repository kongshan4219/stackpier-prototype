'use strict';

const lifeName={draft:'未部署',incomplete:'部署未完成',installed:'已部署',uninstalling:'卸载未完成',uninstalled:'已卸载'};

const runtimeName={running:'运行中',stopped:'已停止',partial:'部分运行',unknown:'待核对',na:'不适用'};

const statusName={running:'执行中',success:'成功',failed:'明确失败',partial:'部分完成',unknown:'结果待核对',rejected:'已拒绝',skipped:'已跳过',missed:'已错过',pending:'未执行',deleted:'已删除'};

const statusTone={running:'running',success:'success',failed:'error',partial:'warning',unknown:'warning',rejected:'warning',skipped:'',missed:'',pending:'',deleted:''};

function badge(text,tone=''){return `<span class="badge ${tone}">${h(text)}</span>`}

function status(v){return badge(statusName[v]||v,statusTone[v]||'')}

function btn(label,action,data={},type='',icon=''){return `<button type="button" class="btn ${type}" data-action="${h(action)}" ${Object.entries(data).map(([k,v])=>`data-${k}="${h(v)}"`).join(' ')}>${icon?I(icon):''}${h(label)}</button>`}

function notice(title,body='',tone=''){return `<div class="notice ${tone}" role="${tone==='error'?'alert':'note'}">${I(tone==='error'||tone==='warning'?'alert':'info')}<div class="grow"><strong>${h(title)}</strong>${body?`<span>${h(body)}</span>`:''}</div></div>`}

function heading(title,desc,actions='',eyebrow='STACKPIER / WORKSPACE'){return `<div class="page-heading"><div><p class="heading-eyebrow">${h(eyebrow)}</p><h1 tabindex="-1">${h(title)}</h1><p>${h(desc)}</p></div><div class="page-actions">${actions}</div></div>`}

function card(title,body,action=''){return `<section class="card"><div class="card-head"><h2>${h(title)}</h2>${action}</div><div class="card-body">${body}</div></section>`}

function empty(title,desc,action=''){return `<div class="empty">${I('box')}<h2>${h(title)}</h2><p>${h(desc)}</p>${action}</div>`}

function detail(items){return `<dl class="detail-list">${items.map(([a,b])=>`<div><dt>${h(a)}</dt><dd>${b}</dd></div>`).join('')}</dl>`}

function field(name,label,value='',hint='',type='text',extra=''){return `<div class="field"><label for="${h(name)}">${h(label)}</label><input id="${h(name)}" name="${h(name)}" type="${h(type)}" value="${h(value)}" autocomplete="off" ${extra}>${hint?`<small>${h(hint)}</small>`:''}</div>`}

function area(name,label,value='',hint='',rows=4){return `<div class="field"><label for="${h(name)}">${h(label)}</label><textarea id="${h(name)}" name="${h(name)}" rows="${rows}" spellcheck="false">${h(value)}</textarea>${hint?`<small>${h(hint)}</small>`:''}</div>`}

function select(name,label,options,value='',hint='',extra=''){return `<div class="field"><label for="${h(name)}">${h(label)}</label><select id="${h(name)}" name="${h(name)}" ${extra}>${options.map(o=>{const [v,t]=Array.isArray(o)?o:[o,o];return `<option value="${h(v)}" ${String(v)===String(value)?'selected':''}>${h(t)}</option>`}).join('')}</select>${hint?`<small>${h(hint)}</small>`:''}</div>`}

function check(name,label,checked=false,hint=''){return `<label class="check"><input name="${h(name)}" type="checkbox" ${checked?'checked':''}><span>${h(label)}${hint?`<small class="muted" style="display:block;margin-top:3px">${h(hint)}</small>`:''}</span></label>`}

function tabs(items,active,action='tab'){return `<div class="tabs" role="navigation" aria-label="内容分类">${items.map(([id,name])=>`<button class="${active===id?'active':''}" data-action="${action}" data-id="${id}" ${active===id?'aria-current="page"':''}>${h(name)}</button>`).join('')}</div>`}

function projectIcon(p){return p.software==='mysql'||p.software==='redis'?'database':p.software==='frpc'?'link':'box'}

function runtimeBadge(p){return badge(runtimeName[p.runtime],p.runtime==='running'?'success':p.runtime==='unknown'||p.runtime==='partial'?'warning':'')}

function searchFilter(placeholder='搜索名称…',extra=''){return `<div class="toolbar"><div class="searchbox">${I('search')}<input id="global-search" data-filter="q" value="${h(ui.q)}" placeholder="${h(placeholder)}" aria-label="${h(placeholder)}"></div>${extra}<span class="grow"></span></div>`}

function channelChecks(name,values){return [['http','HTTP 接口'],['telegram','Telegram'],['email','邮件']].map(([v,t])=>`<label class="check"><input type="checkbox" name="${name}" value="${v}" ${values.includes(v)?'checked':''}><span>${t}</span></label>`).join('')}

function outcomeField(value='success',options=null){return `<div class="form-section">${select('outcome','本次演示结果（原型工具，不是产品设置）',options||[['success','正常完成'],['failed','明确失败（原操作已结束）'],['partial','部分完成'],['unknown','SSH / 响应丢失，结果待核对']],value,'仅注入模拟结果，不连接真实环境。')}</div>`}

function projectChecks(name,selected=[],candidates=S.projects){return `<div class="checkbox-grid">${candidates.map(p=>`<label class="check"><input type="checkbox" name="${name}" value="${p.id}" ${selected.includes(p.id)?'checked':''}><span>${h(p.name)}${p.life==='uninstalled'?'<small class="muted">（已卸载）</small>':''}</span></label>`).join('')}</div>`}

function configurationSourceField(name,label,value=''){return `<div class="field"><label for="${h(name)}">${h(label)}</label><textarea class="config-source-input" id="${h(name)}" name="${h(name)}" rows="16" spellcheck="false" required>
${h(value)}</textarea><small>填写完整 Docker Compose YAML 或 systemd .service 文件，内容按原样保存。</small></div>`;}
