'use strict';

const programFileLimit=256*1024*1024;
const universalFileArchitecture='any';

function programFileSize(bytes){return bytes<1024?`${bytes} B`:bytes<1024*1024?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;}

function storedFileArchitecture(file){return file?.arch||universalFileArchitecture;}
function storedFileArchitectureLabel(file){return storedFileArchitecture(file)===universalFileArchitecture?'通用':storedFileArchitecture(file);}
function storedFileKind(file){return file?.placeholder?'placeholder':file?.kind||(storedFileArchitecture(file)===universalFileArchitecture?'file':'elf');}
function storedFileTypeLabel(file){return storedFileKind(file)==='placeholder'?'占位文件':storedFileKind(file)==='elf'?'ELF 程序':file?.mediaType||file?.format||'通用文件';}
function deployableFile(file){return Boolean(file)&&!file.placeholder&&file.bytes!==0&&file.size!=='0 B';}
function executableFileFor(name,server,files=S.programs){return files.find(file=>deployableFile(file)&&storedFileKind(file)==='elf'&&file.name===name&&storedFileArchitecture(file)===server?.arch)||null;}

// 读取 ELF 标识、字节序和机器类型，不从扩展名或名称猜测架构。
// 字段定义：https://gabi.xinuos.com/elf/02-eheader.html
function programArchitecture(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);
 if(bytes.length<16||bytes[0]!==0x7f||bytes[1]!==0x45||bytes[2]!==0x4c||bytes[3]!==0x46)throw new Error('无法识别架构，请选择 ELF 程序文件。');
 const bits=bytes[4],order=bytes[5],headerSize=bits===1?52:64,little=order===1;
 if(![1,2].includes(bits)||![1,2].includes(order)||bytes[6]!==1||bytes.length<headerSize)throw new Error('文件头不完整或格式无效，无法识别架构。');
 if(view.getUint32(20,little)!==1||view.getUint16(bits===1?40:52,little)!==headerSize)throw new Error('文件头不完整或格式无效，无法识别架构。');
 if(![2,3].includes(view.getUint16(16,little)))throw new Error('请选择程序文件，不支持目标文件或内存转储。');
 const machine=view.getUint16(18,little);
 // ARM 32 位机器类型不包含具体指令集版本，不能将其一律标为 armv7l。
 const architectures={
  '3:1:1':'i386','62:2:1':'x86_64',
  '40:1:1':'arm','40:1:2':'armeb','183:2:1':'aarch64','183:2:2':'aarch64_be',
  '8:1:1':'mipsle','8:1:2':'mips','8:2:1':'mips64le','8:2:2':'mips64',
  '20:1:2':'ppc','21:2:1':'ppc64le','21:2:2':'ppc64','22:2:2':'s390x',
  '243:1:1':'riscv32','243:2:1':'riscv64','258:2:1':'loongarch64',
 };
 const arch=architectures[`${machine}:${bits}:${order}`];
 if(!arch)throw new Error(`暂不支持此 ELF 架构（机器类型 ${machine}）。`);
 return arch;
}

function programFileClassification(buffer){
 const bytes=new Uint8Array(buffer),elf=bytes.length>=4&&bytes[0]===0x7f&&bytes[1]===0x45&&bytes[2]===0x4c&&bytes[3]===0x46;
 if(!elf)return {kind:'file',arch:universalFileArchitecture,format:'通用文件'};
 try{return {kind:'elf',arch:programArchitecture(buffer),format:'ELF 程序'};}
 catch{return {kind:'file',arch:universalFileArchitecture,format:'ELF 文件'};}
}

async function analyzeProgramFile(file){
 if(!file||typeof file.arrayBuffer!=='function'||typeof file.slice!=='function')throw new Error('请选择一个文件。');
 if(!Number.isFinite(file.size)||file.size<0)throw new Error('无法读取文件大小，请重新选择。');
 if(file.size>programFileLimit)throw new Error('当前原型支持分析不超过 256 MB 的文件。');
 if(!globalThis.crypto?.subtle)throw new Error('当前浏览器无法校验文件，请使用 localhost 或 HTTPS 打开原型。');
 let header,content;
 try{header=await file.slice(0,64).arrayBuffer();}catch{throw new Error('文件读取失败，请重新选择。');}
 const classification=programFileClassification(header);
 try{content=await file.arrayBuffer();}catch{throw new Error('文件读取失败，请重新选择。');}
 if(content.byteLength!==file.size)throw new Error('未能完整读取文件，请重新选择。');
 const completeClassification=programFileClassification(content.slice(0,64));
 if(completeClassification.arch!==classification.arch||completeClassification.kind!==classification.kind)throw new Error('读取期间文件类型或架构发生变化，请重新选择。');
 let digest;
 try{digest=await crypto.subtle.digest('SHA-256',content);}catch{throw new Error('文件校验失败，请重新选择。');}
 const sha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
 let text;
 if(classification.kind!=='elf'&&content.byteLength<=65536){try{const decoded=new TextDecoder('utf-8',{fatal:true}).decode(content);if(!/[\u0000-\u0008\u000e-\u001f]/.test(decoded))text=decoded;}catch{}}
 return {sourceName:file.name,...classification,mediaType:String(file.type||'').slice(0,255),bytes:file.size,size:programFileSize(file.size),sha256,...(text!==undefined?{text}:{}),provenance:'浏览器上传元数据 · 未验证可执行'};
}

function programAnalysisTimeout(promise){
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('文件分析超时，请重新选择。')),30000);});
 return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}

function programNameError(name){
 if(!name||name==='.'||name==='..')return '请填写有效的文件名。';
 if(/[\\/\u0000-\u001f\u007f]/.test(name))return '文件名不能包含路径分隔符或控制字符。';
 if(new TextEncoder().encode(name).length>255)return '文件名过长，请缩短后再保存。';
 return '';
}

function duplicateProgramFile(analysis){return S.programs.find(binary=>binary.sha256===analysis.sha256||binary.identity===`sha256:${analysis.sha256}`);}

function programUploadError(draft){
 const analysis=draft.analysis;
 if(!analysis)return '请先选择文件并等待分析完成。';
 if(draft.id){
 const current=S.programs.find(binary=>binary.id===draft.id);
 if(!current||JSON.stringify(current)!==JSON.stringify(draft.original))return '当前文件记录已变化，请关闭弹窗后重新选择。';
  if(storedFileArchitecture(current)!==analysis.arch)return `此记录的适用范围为 ${storedFileArchitectureLabel(current)}，所选文件为 ${storedFileArchitectureLabel(analysis)}。请通过“上传文件”新增其他范围的文件。`;
 }
 const duplicate=duplicateProgramFile(analysis);
 if(duplicate)return duplicate.id===draft.id?'所选文件与当前文件内容相同，无需替换。':`该文件已作为“${duplicate.filename}”（${storedFileArchitectureLabel(duplicate)}）保存，不能更名重复上传。`;
 return '';
}
