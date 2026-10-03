import { prototype } from './prototype-harness.mjs';

let savedReference;

// 旧参考清单专用于已有部署、迁移与未知结果回归，不代替当前默认样例。
export function referencePrototype(saved, options) {
  if (saved !== undefined) return prototype(saved, options);
  if (!savedReference) {
    const p = prototype();
    p.run('S=initial();S.frp=frpReferenceSample();S.frp.sampleVersion="reference-fixture";persist();');
    savedReference = p.saved();
  }
  return prototype(savedReference, options);
}
