import React from 'react';
import {Tabs,ToggleGroup,Collapsible} from 'radix-ui';
import {PlusIcon,ArrowRightIcon,ChevronDownIcon,MagnifyingGlassIcon,RowsIcon,GridIcon} from '@radix-ui/react-icons';
import {Button,Input} from '@design/ui';
import {copy,recordCount} from './copy';
import {FragmentView} from './fragments';

export function Action({action,data={},children,...props}) {
  return <Button data-action={action} {...Object.fromEntries(Object.entries(data).map(([k,v])=>['data-'+k,v]))} {...props}>{children}</Button>;
}
export function PageHeading({title,description,children}) {
  return <header className="page-heading"><div><h1 tabIndex={-1}>{title}</h1>{description&&<p>{description}</p>}</div><div className="page-actions">{children}</div></header>;
}
export function Projects({view}) {
  const {ui,projects,servers,failedCount,operationCount,operationHTML}=view;
  const select=(field,value)=>window.StackPierUI.filter(field,value);
  return <>
    <PageHeading title={copy.projects} description={copy.projectDescription}><Action action="newproject" variant="primary"><PlusIcon/>{copy.deploy}</Action></PageHeading>
    <Tabs.Root value={ui.projectsTab||'list'} onValueChange={id=>window.StackPierUI.action('projectstab',{id})}>
      <Tabs.List className="tabs" aria-label={copy.projects}>
        <Tabs.Trigger className="tab" value="list">{copy.list}</Tabs.Trigger>
        <Tabs.Trigger className="tab" value="failures">{copy.failures}<span className="tab-count">{failedCount}</span></Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
    {operationCount>0&&<Collapsible.Root className="pending-summary"><Collapsible.Trigger className="pending-trigger"><span className="status-dot warning"/><strong>{copy.operations}</strong><span className="badge warning">{operationCount}</span><span className="grow"/><ChevronDownIcon/></Collapsible.Trigger><Collapsible.Content className="pending-content"><p className="muted mb">{copy.evidence}</p><FragmentView html={operationHTML}/></Collapsible.Content></Collapsible.Root>}
    <div className="toolbar project-toolbar">
      <div className="searchbox"><MagnifyingGlassIcon/><Input id="global-search" aria-label={copy.search} placeholder={copy.search} value={ui.q} onChange={e=>select('q',e.target.value)}/></div>
      <select className="filter" aria-label={copy.allServers} value={ui.server} onChange={e=>select('server',e.target.value)}><option value="all">{copy.allServers}</option>{servers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select className="filter" aria-label={copy.stateFilter} value={ui.filter} onChange={e=>select('filter',e.target.value)}>{['all','running','stopped','partial','unknown','pending','cleanup'].map(id=><option key={id} value={id}>{id==='all'?copy.allStates:copy[id]}</option>)}</select>
      <ToggleGroup.Root type="single" className="segmented ml-auto" value={ui.view} aria-label={copy.views} onValueChange={id=>id&&window.StackPierUI.action('projectview',{id})}><ToggleGroup.Item value="table" aria-label={copy.table}><RowsIcon/></ToggleGroup.Item><ToggleGroup.Item value="cards" aria-label={copy.cards}><GridIcon/></ToggleGroup.Item></ToggleGroup.Root>
    </div>
    {!projects.length?<section className="card empty"><h2>{copy.noProjects}</h2><p>{copy.noProjectsText}</p><Button onClick={()=>window.StackPierUI.clearFilters()}>{copy.clear}</Button></section>:<>
      <div className={ui.view==='cards'?'project-cards':'project-table card'}>
        {ui.view!=='cards'&&<div className="project-columns project-column-head"><span>{copy.project}</span><span>{copy.server}</span><span>{copy.observation}</span><span>{copy.issues}</span><span className="right">{copy.actions}</span></div>}
        {projects.map(p=><article className="project-record" key={p.id}>
          <div className="project-identity"><Action action="project" data={{id:p.id}} variant="ghost" className="project-name">{p.name}</Action><p className="cell-sub">{p.typeLabel}</p></div>
          <div className="project-server"><span>{p.serverName}</span><p className="cell-sub mono">{p.host}</p></div>
          <div className="project-observation"><FragmentView html={p.runtimeHTML}/><p className="cell-sub">{p.observedLabel}</p></div>
          <div className="project-issues"><FragmentView html={p.issueHTML||`<span class="muted">${copy.noIssue}</span>`}/></div>
          <div className="project-action"><Action action="project" data={{id:p.id}} size="small" variant="ghost">{p.cleanup?copy.continueCleanup:copy.manage}<ArrowRightIcon/></Action></div>
        </article>)}
      </div><p className="result-count">{recordCount(projects.length)}</p>
    </>}
  </>;
}
export function ProjectDetail({view}) {
  const p=view.project;
  if(!p)return <FragmentView html={view.html}/>;
  return <>
    <Action action="navigate" data={{page:'projects'}} variant="ghost" className="back-link">← {copy.back}</Action>
    <PageHeading title={p.name} description={p.subtitle}>
      {p.cleanup?<Action action="projectop" data={{id:p.id,kind:'uninstall'}} variant="danger">{copy.continueCleanup}</Action>:<>
        <Action action="projectop" data={{id:p.id,kind:p.runtime==='running'?'stop':'start'}}>{p.runtime==='running'?copy.stop:copy.start}</Action>
        {!p.unit&&<Action action="projectop" data={{id:p.id,kind:'apply'}} variant="primary">{copy.apply}</Action>}
        <Action action="projectmore" data={{id:p.id}}>{copy.more}<ChevronDownIcon/></Action>
      </>}
    </PageHeading>
    <FragmentView html={p.notices}/><FragmentView html={p.summary}/>
    <Tabs.Root value={view.ui.tab} onValueChange={id=>window.StackPierUI.action('tab',{id})}>
      <Tabs.List className="tabs" aria-label={p.name}>{['overview','config','monitor','logs','history'].map(id=><Tabs.Trigger className="tab" key={id} value={id}>{copy[id]}</Tabs.Trigger>)}</Tabs.List>
      <Tabs.Content value={view.ui.tab} className="detail-tab"><FragmentView html={p.content}/></Tabs.Content>
    </Tabs.Root>
  </>;
}
