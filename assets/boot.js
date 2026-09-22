'use strict';

// 初始化集中在依赖加载完成之后；页面和事件组件本身不重复启动工作台。
if (prototypeLoading.errors.length) {
  showPrototypeLoadError();
} else {
  try {
    initializeFrp();
    prototypeLoading.ready = true;
  } catch (error) {
    prototypeLoading.errors.push(error.message);
    showPrototypeLoadError();
    console.error('原型初始化失败', error);
  }
}
