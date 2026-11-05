import React from 'react';

// 仅接收原型模型中已转义的 HTML。保留现有表单、草稿和恢复处理器；不解析、改写或猜测控件语义。
export function FragmentView({html='',as:Tag='div',className='',...props}) {
  return <Tag className={className} dangerouslySetInnerHTML={{__html:html}} {...props}/>;
}
