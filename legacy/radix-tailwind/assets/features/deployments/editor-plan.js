'use strict';

// 新编辑器保存固定输入；转换只发生在新的部署预览，不回写历史项目。
function configurationProjectDraft(t,draft){
 if(!t.editorSchema)return draft;
 if(t.type==='systemd'&&!t.frpRole){
  if(t.editorSchema===2){
   draft.cfg={...draft.cfg,systemdMode:'unit',source:t.tpl,pathMappings:clone(t.pathMappings||[]).map(row=>({...row,...(row.kind==='directory'?{deleteExtraneous:true}:{})})),program:'',programRef:null,configRef:null,port:null,appConfig:'',fileMappings:[]};
   return draft;
  }
  const root='/srv/stackpier-demo/'+draft.name,program=configurationVersion(configurationVersionValue(t.programRef?.pins?.[0])),config=configurationVersion(configurationVersionValue(t.configRef?.pins?.[0]));
  draft.cfg.source=`[Unit]\nDescription=${draft.name}\nAfter=network.target\n[Service]\nExecStart=${root}/program\nEnvironment=STACKPIER_CONFIG=${root}/config.json\nRestart=on-failure\n[Install]\nWantedBy=multi-user.target`;
  draft.cfg.fileMappings=[{...clone(t.programRef),file:program?.name||'程序版本已失效',targetPath:root+'/program'},{...clone(t.configRef),file:config?.name||'配置版本已失效',targetPath:root+'/config.json'}];
  draft.cfg.appConfig=config?.text||'';draft.cfg.configRef=clone(t.configRef);
 }
 if(t.type==='compose'){draft.cfg.composeFiles=clone(t.composeFiles||[]);draft.cfg.pathMappings=clone(t.pathMappings||[]).map(row=>({...row,...(row.kind==='directory'?{deleteExtraneous:true}:{})}));}
 return draft;
}
function configurationFrpFiles(node,role,source,parameters){
 const files=frpFiles(node,role,source);if(!parameters)return files;
 const f=parameters;
 const parametersText=(role==='server'?`proxyBindAddr = "127.0.0.1"\nallowPorts = [{ start = ${f.allowedPortStart}, end = ${f.allowedPortEnd} }]\n`:'')+`webServer.addr = "127.0.0.1"\nwebServer.port = ${f.adminPort}\n`;
 files.toml=parametersText+'\n'+files.toml;
 if(role==='visitor'&&!node.proxies.length)files.unit=files.unit.replace(/^After=.*$/m,'After=network.target').replace(/^Requires=.*\n?/m,'');
 return files;
}
