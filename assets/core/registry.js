'use strict';

// 页面组件登记各自的交互；共享状态只由 core/state.js 持有。
const prototypeActions = Object.create(null);
const prototypeForms = Object.create(null);
const prototypeModals = Object.create(null);
function registerPrototypeHandlers(registry, names, handler) {
  for (const name of names) {
    if (Object.hasOwn(registry, name)) throw new Error('重复的原型交互：' + name);
    registry[name] = handler;
  }
}
