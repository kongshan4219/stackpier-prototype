import {prototype} from './prototype-harness.mjs';
import {simulatePrograms} from './frp-fixtures.mjs';
export function readyServices(){
 const p=simulatePrograms(prototype());
 p.run(`for(const p of S.projects.filter(p=>p.frpService)){const role=p.frpService.role;p.frpApplied.programRef=clone(frpProgramRef(role));p.frpApplied.program=clone(frpResolveProgram(p.frpApplied.programRef,p.server).file);p.frpDraft=clone(p.frpApplied);p.cfg.frpSnapshot=clone(p.frpApplied);p.applied.frpSnapshot=clone(p.frpApplied);}persist();`);
 return p;
}
export function deployService(p,role,name,server,fields={}){
 p.click('newproject',{template:'frp-template-'+role,server});
 p.submit('newproject',{'np-template':'frp-template-'+role,'np-server':server,'np-name':name,...fields});
 return p;
}
