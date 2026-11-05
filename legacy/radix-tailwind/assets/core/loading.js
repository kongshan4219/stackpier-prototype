'use strict';

// 在组件请求前监听加载错误，避免缺少组件时展示不完整的工作台。
const prototypeLoading = { errors: [], ready: false };

function showPrototypeLoadError() {
  const status = document.getElementById('boot-status');
  const reload = document.getElementById('reload');
  if (status) status.textContent = '原型组件加载失败，请通过 HTTP 打开原型目录并重新加载。';
  if (reload) reload.hidden = false;
}

window.addEventListener('error', event => {
  if (prototypeLoading.ready) return;
  prototypeLoading.errors.push(event.message || '静态组件加载失败');
  showPrototypeLoadError();
}, true);

document.addEventListener('DOMContentLoaded', () => {
  const reload = document.getElementById('reload');
  if (reload) reload.addEventListener('click', () => location.reload());
  if (prototypeLoading.errors.length) showPrototypeLoadError();
});
