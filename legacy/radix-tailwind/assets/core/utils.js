'use strict';

const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const clone=v=>JSON.parse(JSON.stringify(v));

const now=()=>new Date().toISOString();

const fmt=t=>{if(!t)return'尚未检查';const d=new Date(t);return Number.isNaN(+d)?h(t):d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});};

const uid=pre=>`${pre}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

function validIPv4(s){const a=s.split('.');return a.length===4&&a.every(v=>/^\d{1,3}$/.test(v)&&+v<=255)}

function validIPv6(s){try{return s.includes(':')&&new URL('http://['+s+']/').hostname.length>2}catch{return false}}

function validAddress(s){const [ip,bits,...rest]=s.split('/');if(rest.length)return false;const v4=validIPv4(ip),v6=validIPv6(ip);return (v4||v6)&&(bits===undefined||(/^\d+$/.test(bits)&&+bits<=(v4?32:128)));}
