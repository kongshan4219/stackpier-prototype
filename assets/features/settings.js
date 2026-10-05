'use strict';

function settingsPage(){return heading('设置','仅保存演示配置，不发送通知、不访问 Cloudflare。','','INSTANCE / SETTINGS')+`<div class="grid2"><section class="card"><div class="card-head"><h2>默认通知渠道</h2><span class="tag">项目可覆盖</span></div><div class="card-body"><form class="stack" data-form="settings"><div class="flex wrap">${channelChecks('channels',S.settings.channels)}</div>${field('setting-http','自定义 HTTP 通知地址',S.settings.http,'原型不会请求此地址；请仅使用示例值。','url')}${field('setting-tg','Telegram 目标（演示）',S.settings.telegram)}${field('setting-email','通知邮箱（演示）',S.settings.email,'','email')}${select('setting-zone','时间显示时区',[['Asia/Tokyo','Asia/Tokyo'],['Asia/Shanghai','Asia/Shanghai'],['UTC','UTC']],S.settings.timezone,'仅影响演示时间设置。')}<div class="form-bottom">${btn('模拟测试通知','testnotice',{},'') }<button class="btn primary" type="submit">保存演示设置</button></div></form></div></section><div class="stack">${card('通知行为',detail([['持续异常','每次检查仍发送'],['恢复正常','不额外发送恢复通知'],['自动修复','不启用，不提供'],['通知渠道','HTTP / Telegram / 邮件']]))}${card('Cloudflare 账号',`<p class="small">${S.cloudflare.connections.filter(c=>!c.removedAt).length} 个当前演示连接</p><p class="cell-sub mt">与工作空间 / DNS 共用账号管理，逐 Zone 检查读写权限。只保存虚构凭据引用，不接入真实 Cloudflare。</p>`,btn('管理 Cloudflare 账号','cfaccount',{},'small'))}</div></div>`}

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["testnotice"], function(event, target, d, a) {
  switch (a) {
case'testnotice':record('测试通知','notification',null,'success','仅模拟通知通路，不发出任何网络请求。');S.notifications.unshift({id:uid('ntf'),time:now(),project:null,channel:'全局渠道 · 演示',status:'success',text:'测试通知（仅浏览器记录，未发送）'});persist();render();toast('已记入一条模拟测试通知，未真实发送。');break;
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["settings"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'settings':S.settings={...S.settings,channels:all('channels'),http:get('setting-http'),telegram:get('setting-tg'),email:get('setting-email'),timezone:get('setting-zone')};persist();render();toast('仅保存演示通知设置，未发出网络请求。');break;
  }
});
