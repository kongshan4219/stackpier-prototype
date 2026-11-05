import { prototype } from './prototype-harness.mjs';

// 成功/部分/未知回归使用明确虚构的元数据；不使用附件 0 B 程序绕过资产校验。
export function simulatePrograms(p) {
  p.run(`frpEnsure();for(const server of S.servers){server.state='online';server.checked=now();if(server.id==='frp-source'){server.host='192.0.2.230';server.user='qa';}}
  for(const source of S.programs.filter(f=>f.id.startsWith('frp-bin-'))){
    const id='qa-'+source.id;let f=assetById(id);if(!f){f={...clone(source),id,groupId:'qa-'+source.groupId,revisions:[]};S.programs.push(f);}
    ensureAsset(f);Object.assign(f,{revision:2,bytes:64,size:'64 B · 测试模拟元数据',placeholder:false,kind:'elf',identity:'TEST_METADATA_'+f.id,provenance:'模拟二进制元数据'});
    f.revisions.push({...clone(f),revisions:undefined});
  }for(const role of Object.keys(frpRoles)){const t=tpl('frp-template-'+role);t.programRef={...t.programRef,groupId:'qa-asset-frp-bin-'+frpProgramName(role),pins:S.programs.filter(f=>f.id.startsWith('qa-frp-bin-'+frpProgramName(role))).map(f=>({fileId:f.id,revision:2}))};}frpSyncConfigs();for(const p of S.projects.filter(p=>p.frpRef||p.frpInstallation)){
    const role=p.frpRef?.role||p.frpInstallation.role,n=p.frpRef?frpNode(p.frpRef.node):p.frpApplied?.node;
    if(n)frpAdoptProject(p,frpPublicCandidate(n,role));
  }persist();`);
  return p;
}
export function referencePrototype(saved, options={}) {
  if (saved !== undefined) return prototype(saved, options);
  const p=prototype(undefined,{hash:'#frp'});
  p.run(`S=initial();S.frp=frpReferenceSample();S.frp.sampleVersion="reference-fixture";frpEnsure();for(const server of S.servers){server.state='online';server.checked=now();if(server.id==='frp-source'){server.host='192.0.2.230';server.user='qa';}}persist();`);
  if(options.mockPrograms!==false)simulatePrograms(p);
  return prototype(p.saved(), options);
}
