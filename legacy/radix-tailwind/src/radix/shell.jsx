import React,{useRef,useState} from 'react';
import {Dialog,DropdownMenu} from 'radix-ui';
import * as Icons from '@radix-ui/react-icons';
import {Button} from '@design/ui';
import {copy} from './copy';
import {FragmentView} from './fragments';
import {Action,PageHeading,Projects,ProjectDetail} from './projects';
import FirewallPort from './firewall-port/page';

const icons={overview:Icons.DashboardIcon,servers:Icons.DesktopIcon,projects:Icons.CubeIcon,templates:Icons.FileTextIcon,programs:Icons.ArchiveIcon,frp:Icons.Link2Icon,monitor:Icons.ActivityLogIcon,firewall:Icons.LockClosedIcon,dns:Icons.GlobeIcon,operations:Icons.CounterClockwiseClockIcon,settings:Icons.GearIcon};
function Brand({onNavigate}){return <a href="#overview" className="brand" data-action="navigate" data-page="overview" onClick={onNavigate}><span className="brand-letter" aria-hidden="true">栈</span><strong>{copy.product}</strong><span>{copy.english}</span></a>;}
function Navigation({view,onNavigate}) {
  const page=view.ui.page==='project'?'projects':view.ui.page;
  return <><div className="sidebar-brand"><Brand onNavigate={onNavigate}/></div><nav aria-label={copy.mainNavigation} className="sidebar-navigation">{view.nav.map(([id,label,,group])=><React.Fragment key={id}>{group&&<p className="sidebar-label">{group}</p>}<button className={`sidebar-link ${page===id?'current':''}`} aria-current={page===id?'page':undefined} data-action="navigate" data-page={id} onClick={onNavigate}>{React.createElement(icons[id]||Icons.FileIcon)}<span>{label}</span>{id==='operations'&&view.activeOperations>0&&<span className="nav-count">{view.activeOperations}</span>}</button></React.Fragment>)}</nav><div className="sidebar-bottom"><p className="font-medium">{copy.workspace}</p><p className="tiny muted mt-1">{copy.local}</p><Action action="logout" variant="ghost" className="sidebar-logout"><Icons.ExitIcon/>{copy.logout}</Action></div></>;
}
function ReviewMenu({mode,setMode,scenario,setScenario}) {
  return <div className="review-controls"><Button variant="ghost" size="icon" aria-label={copy.theme} title={mode==='light'?copy.light:copy.dark} onClick={()=>setMode(mode==='light'?'dark':'light')}>{mode==='light'?<Icons.SunIcon/>:<Icons.MoonIcon/>}</Button>
    <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="ghost">{copy.tools}<Icons.ChevronDownIcon/></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="menu" align="end" sideOffset={8}>
      <DropdownMenu.Label className="menu-label">{copy.state}</DropdownMenu.Label><DropdownMenu.RadioGroup value={scenario} onValueChange={setScenario}>{['normal','loading','empty','error'].map(value=><DropdownMenu.RadioItem key={value} value={value} className="menu-item"><span className="menu-indicator"><DropdownMenu.ItemIndicator><Icons.CheckIcon/></DropdownMenu.ItemIndicator></span>{copy[value]}</DropdownMenu.RadioItem>)}</DropdownMenu.RadioGroup><DropdownMenu.Separator className="separator"/>
      {['scenes','feedback','about'].map(action=><DropdownMenu.Item key={action} className="menu-item" onSelect={()=>setTimeout(()=>window.StackPierUI.action(action),0)}>{copy[action]}</DropdownMenu.Item>)}
    </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
  </div>;
}
function PageState({scenario,reset,title}) {
  return <><PageHeading title={title}/><section className="review-state" role={scenario==='error'?'alert':'status'}>
    {scenario==='loading'?<Icons.ReloadIcon className="animate-spin"/>:scenario==='empty'?<Icons.ArchiveIcon/>:<Icons.ExclamationTriangleIcon/>}
    <h2>{copy[`${scenario}Title`]}</h2><p>{copy[`${scenario}Text`]||copy.simulation}</p><Button onClick={reset}>{scenario==='error'?copy.retry:copy.recover}</Button>
  </section></>;
}
export default function Shell({view,mode,setMode}) {
  const [navOpen,setNavOpen]=useState(false),[scenario,setScenario]=useState('normal');
  const navigationChosen=useRef(false);
  const closeNavigation=()=>{navigationChosen.current=true;setNavOpen(false)};
  // Escape can arrive before Radix installs its document listener after opening.
  // Keep a local fallback for this drawer; registered Radix handlers prevent it.
  const navigationKeyDown=event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();setNavOpen(false)}};
  return <><a className="skip-link" href="#main">{copy.skip}</a>
    <div className="review-bar"><div className="review-label"><span className="review-tag">{copy.prototype}</span><span className="review-number">{copy.simulation}</span></div><ReviewMenu {...{mode,setMode,scenario,setScenario}}/></div>
    {view.ui.auth?<FragmentView html={view.authHTML}/>:<div className="workspace-shell">
      <aside className="workspace-sidebar" id="workspace-navigation"><Navigation view={view}/></aside>
      <div className="workspace-content"><header className="topline">
        <div className="flex min-w-0"><Dialog.Root open={navOpen} onOpenChange={open=>{navigationChosen.current=false;setNavOpen(open)}}><Dialog.Trigger asChild><Button className="mobile-nav-trigger" variant="ghost" size="icon" aria-label={copy.navigation}><Icons.HamburgerMenuIcon/></Button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="navigation-drawer" aria-describedby={undefined} onKeyDown={navigationKeyDown} onCloseAutoFocus={event=>{if(navigationChosen.current){event.preventDefault();requestAnimationFrame(()=>document.querySelector('.page-heading h1')?.focus({preventScroll:true}))}}}><Dialog.Title className="sr-only">{copy.navigation}</Dialog.Title><Dialog.Close asChild><Button className="nav-close" variant="ghost" size="icon" aria-label={copy.close}><Icons.Cross2Icon/></Button></Dialog.Close><Navigation view={view} onNavigate={closeNavigation}/></Dialog.Content></Dialog.Portal></Dialog.Root>
        <span className="breadcrumb-root">{copy.workspace}</span><Icons.ChevronRightIcon/><span className="breadcrumb-current">{view.title}</span></div><span className="topline-caption">{copy.prototype}</span>
      </header>
      <main id="main" className={`workbench page-${view.ui.page}`} tabIndex={-1} data-screen-label={view.title}>
        {scenario!=='normal'?<PageState scenario={scenario} title={view.title} reset={()=>setScenario('normal')}/>:<>
          {view.ui.routeNotice&&<div role="alert" className="notice warning">{view.ui.routeNotice}</div>}
          {view.ui.page==='projects'&&view.ui.projectsTab!=='failures'?<Projects view={view}/>:view.ui.page==='project'?<ProjectDetail view={view}/>:view.ui.page==='firewall'&&new URLSearchParams(location.search).get('firewall')==='1panel'?<FirewallPort/>:<FragmentView html={view.html}/>}
        </>}
      </main><footer className="app-footer">{copy.product} · {copy.workspace}<span>{copy.simulation}</span></footer></div>
    </div>}
  </>;
}
