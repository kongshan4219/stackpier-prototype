import { prototype } from './prototype-harness.mjs';

// 成功/部分/未知回归使用明确虚构的元数据；不使用附件 0 B 程序绕过资产校验。
export function simulatePrograms(p) {
  p.run(`frpEnsure();for(const f of S.programs.filter(f=>f.id.startsWith('frp-bin-'))){
    ensureAsset(f);Object.assign(f,{revision:2,bytes:64,size:'64 B · 测试模拟元数据',placeholder:false,kind:'elf',identity:'TEST_METADATA_'+f.id,provenance:'模拟二进制元数据'});
    f.revisions.push({...clone(f),revisions:undefined});
  }frpSyncConfigs();for(const p of S.projects.filter(p=>p.frpRef||p.frpInstallation)){
    const role=p.frpRef?.role||p.frpInstallation.role,n=p.frpRef?frpNode(p.frpRef.node):p.frpApplied?.node;
    if(n)frpAdoptProject(p,frpPublicCandidate(n,role));
  }persist();`);
  return p;
}
export function referencePrototype(saved, options={}) {
  if (saved !== undefined) return prototype(saved, options);
  const p=prototype(undefined,{hash:'#frp'});
  p.run('S=initial();S.frp=frpReferenceSample();S.frp.sampleVersion="reference-fixture";frpEnsure();persist();');
  if(options.mockPrograms!==false)simulatePrograms(p);
  return prototype(p.saved(), options);
}
