import { File } from 'node:buffer';
import { prototype } from './prototype-harness.mjs';

// 仅供原型文件格式分析的非空 ELF 夹具；不执行，也不声称能运行 FRP。
export function qaElf(stamp = 1, machine = 62) {
 const bytes = new Uint8Array(96), view = new DataView(bytes.buffer);
 bytes.set([127,69,76,70,2,1,1]); view.setUint16(16,2,true); view.setUint16(18,machine,true);
 view.setUint32(20,1,true); view.setUint16(52,64,true); bytes[95]=stamp; return bytes;
}
export const qaServicesScript = `
var qaFiles=S.programs.filter(f=>f.filename.startsWith('qa-evidence-'));
var qaRef=name=>({groupId:qaFiles.find(f=>f.filename==='qa-evidence-'+name).groupId,architectureRule:'auto',pins:[{fileId:qaFiles.find(f=>f.filename==='qa-evidence-'+name).id,revision:1}]});
for(const id of ['s2','s4']){sr(id).state='online';sr(id).checked=now();}
var qaBindings={};
for(const [role,source] of [['client','frp-n3-client'],['server','frp-installed-s4-server'],['visitor','frp-n3-visitor']]){
 for(const suffix of role==='server'?['a']:['a','b']){
  const p=clone(pr(source)),id='qa-evidence-'+role+'-'+suffix,host=role==='client'?'s2':'s4';
  p.id=id;p.name=id;p.server=host;p.serverName=sname(host);p.template='qa-template-'+role;p.frpService={role};
  delete p.frpRef;delete p.frpInstallation;delete p.frpWritePending;delete p.resourceLedger;delete p.ownedResources;delete p.cleanup;
  const ref=qaRef(role==='server'?'frps':'frpc'),a=p.frpApplied;a.host=host;a.unit=id+'.service';a.programRef=ref;a.program=clone(frpResolveProgram(ref,host).file);
  a.node={...a.node,id:'qa-unbound-'+id,provider:'s2',server:'s4',ip:sr('s4').host,bind_port:7788,proxies:[]};a.settings=frpSettingsSnapshot();
  a.files={...frpFiles(a.node,role,a.settings),tomlPath:'/srv/services/frp/projects/'+id+'/'+frpPrefixes[role]+'.toml',unitPath:'/etc/systemd/system/'+id+'.service',binaryPath:S.frp.root+'/bin/'+frpProgramName(role)};
  a.files.unit=a.files.unit.replace(/^ExecStart=.*$/m,'ExecStart='+a.files.binaryPath+' -c '+a.files.tomlPath);
  p.frpDraft=clone(a);p.cfg.frpSnapshot=clone(a);p.applied.frpSnapshot=clone(a);p.cfg.appConfig=p.applied.appConfig=a.files.toml;p.cfg.dataDir=p.applied.dataDir=S.frp.root+'/projects/'+id;
  S.projects.push(p);qaBindings[role+suffix]=id;
 }
 const t=clone(tpl('frp-template-'+role));t.id='qa-template-'+role;t.name='QA '+frpRoles[role];t.programRef=qaRef(role==='server'?'frps':'frpc');t.revisions=[clone({...t,revisions:undefined})];S.templates.push(t);
}
var qaNode={id:'qa-evidence-node',provider:'s2',server:'s4',ip:sr('s4').host,ssh_user:sr('s4').user,arch:'x86_64',bind_addr:'0.0.0.0',bind_port:7788,client_enabled:true,revision:1,configurationManaged:true,serviceBindings:{client:qaBindings.clienta,server:qaBindings.servera,visitor:qaBindings.visitora},roleProjects:{server:qaBindings.servera},serverUnit:pr(qaBindings.servera).frpApplied.unit,sourceSettings:frpSettingsSnapshot(),proxies:[{name:'qa-residual',type:'stcp',local_ip:'127.0.0.1',local_port:3306,secret_key:'DEMO_QA_RESIDUAL',visitor_bind_addr:'127.0.0.1',visitor_bind_port:14307}]};
S.frp.nodes.push(qaNode);frpSyncConfigs();initializeResourceLedgers();persist();render();`;

export async function evidenceServices() {
 const p=prototype();
 for(const [name,stamp] of [['frpc',91],['frps',92]]){
  p.click('programupload');await p.changeFiles([new File([qaElf(stamp)],'qa-evidence-'+name)]);
  p.submit('programupload',{});p.submit('programname',{'bin-filename':'qa-evidence-'+name});
 }
 p.run(qaServicesScript);return p;
}
