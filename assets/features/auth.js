'use strict';

function authPage(){const setup=ui.auth==='setup',success=ui.auth==='setup-success',blocked=ui.auth==='blocked';return `<div class="auth-shell"><header class="auth-header">${brand()}<span class="small muted">${setup?'首次使用':'实例访问'} · 仅演示</span></header><main class="auth-main"><section class="auth-card">${blocked?`<h1>远程初始化受限</h1><p class="small muted">这是现有访问边界的演示状态，请从允许的初始化来源完成首次设置。</p><div class="mt">${btn('切换到允许的演示来源','authsetup',{},'primary')}</div>`:success?`<h1>设置完成</h1><p class="small muted">演示访问密码已在本页内存中设置。下一步登录工作台。</p><div class="mt">${btn('前往登录','authlogin',{},'primary')}</div>`:`<h1>${setup?'设置你的栈桥':'欢迎回到栈桥'}</h1><p class="small muted">${setup?'设置演示访问密码，开始使用个人管理空间。':'输入演示访问密码，进入工作台。'}</p><form data-form="auth" class="stack">${field('access-password',setup?'设置访问密码':'访问密码','','请勿输入真实密码；这里只模拟界面，不提供实际访问保护。','password','required')}${setup?field('access-confirm','再次输入密码','','','password','required'):''}<p id="auth-error" class="field-error" role="alert" hidden></p><button type="submit" class="btn primary">${setup?'完成设置':'登录'}</button>${btn('填入演示密码','fillpassword',{},'ghost')}</form>`}<p class="cell-sub mt">演示密码：<code>${DEMO_PASSWORD}</code></p></section><div class="flex between mt">${btn('直接进入演示工作台','demologin',{},'ghost')}${btn(setup?'已有实例，去登录':'体验首次初始化',setup?'authlogin':'authsetup',{},'ghost')}</div></main></div>`}

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["logout","authsetup","authlogin","demologin","fillpassword"], function(event, target, d, a) {
  switch (a) {
case'logout':closeModal();ui.auth='login';ui.nav=false;render();toast('已退出演示工作台。已保存的非敏感演示状态保留。');break;
case'authsetup':ui.auth='setup';ui.initialized=false;render();break;
case'authlogin':ui.auth='login';render();break;
case'demologin':ui.auth=null;navigate('overview');break;
case'fillpassword':document.getElementById('access-password').value=ui.password||DEMO_PASSWORD;const ac=document.getElementById('access-confirm');if(ac)ac.value=ui.password||DEMO_PASSWORD;break;
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["auth"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'auth':{const password=String(fd.get('access-password')||''),er=document.getElementById('auth-error');if(ui.auth==='setup'){if(password.length<8||password!==fd.get('access-confirm')){er.hidden=false;er.textContent='请使用至少 8 位的演示密码，并确保两次输入一致。';break;}ui.password=password;ui.initialized=true;ui.auth='setup-success';render();}else if(password===ui.password){ui.auth=null;navigate('overview');}else{er.hidden=false;er.textContent='访问密码不正确，未进入工作台。请使用展示的演示密码。';}break;}
  }
});
