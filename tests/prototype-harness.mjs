import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity]);

function attributes(source) {
  return Object.fromEntries([...source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(([, name, quoted, single, bare]) => [name, decode(quoted ?? single ?? bare ?? '')]));
}

// 这里只提供渲染函数和表单事件所需的内存接口；布局、焦点与点击命中由浏览器验证。
class Element {
  constructor(tag = 'div', attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.id = attrs.id || '';
    this.name = attrs.name || '';
    this.type = attrs.type || '';
    this.value = attrs.value ?? (this.type === 'checkbox' ? 'on' : '');
    this.checked = Object.hasOwn(attrs, 'checked');
    this.disabled = Object.hasOwn(attrs, 'disabled');
    this.hidden = Object.hasOwn(attrs, 'hidden');
    this.dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
    this.style = {};
    this.classList = { toggle() {}, add() {}, remove() {} };
    this.children = [];
    this.open = false;
    this.textContent = '';
    this._html = '';
    this.listeners = new Map();
  }
  set innerHTML(value) { this._html = value; this.children = elements(value); }
  get innerHTML() { return this._html; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { return this.children.filter(element => matches(element, selector)); }
  closest(selector) { return matches(this, selector) ? this : this.form?.closest(selector) || null; }
  appendChild(element) { this.children.push(element); return element; }
  append(element) { this.appendChild(element); }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener(type, callback, capture = false) { const list = this.listeners.get(type) || []; list.push({ callback, capture: capture === true }); this.listeners.set(type, list); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() {}
  select() {}
  setSelectionRange() {}
  scrollIntoView() {}
  remove() {}
}

function matches(element, selectors) {
  return selectors.split(',').some(selector => {
    selector = selector.trim();
    const tag = selector.match(/^[a-z]+/i)?.[0];
    if (tag && element.tagName !== tag.toUpperCase()) return false;
    const id = selector.match(/#([\w-]+)/)?.[1];
    if (id && element.id !== id) return false;
    return [...selector.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/g)].every(([, key, value]) => Object.hasOwn(element.attrs, key) && (value === undefined || element.attrs[key] === value));
  });
}

function elements(html) {
  return [...html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].map(match => {
    const element = new Element(match[1], attributes(match[2]));
    if (element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
      const content = html.slice(match.index + match[0].length).split(new RegExp(`</${match[1]}\\s*>`, 'i'))[0];
      if (element.tagName === 'TEXTAREA') element.value = decode(content);
      else {
        const options = [...content.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/gi)].map(([, attrs, text]) => ({ attrs: attributes(attrs), text }));
        const selected = options.find(option => Object.hasOwn(option.attrs, 'selected')) || options[0];
        element.value = selected ? selected.attrs.value ?? decode(selected.text) : '';
      }
    }
    return element;
  });
}

class FormData {
  constructor(form) { this.values = Object.entries(form.values || {}).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(item => [key, item])); }
  get(key) { return this.values.find(([name]) => name === key)?.[1] ?? null; }
  getAll(key) { return this.values.filter(([name]) => name === key).map(([, value]) => value); }
  has(key) { return this.values.some(([name]) => name === key); }
  forEach(callback) { this.values.forEach(([key, value]) => callback(value, key)); }
}

export function prototype(saved, { hash = '', missingScript } = {}) {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script>/gi)].map(([, source]) => attributes(source));
  assert.ok(scripts.length > 1, '入口应按顺序直接加载组件脚本');
  assert.equal(scripts[0].src, 'assets/core/loading.js', '先同步注册静态组件加载错误处理');
  assert.equal(Object.hasOwn(scripts[0], 'defer'), false);
  assert.ok(scripts.every(script => script.src && !Object.hasOwn(script, 'async') && script.type !== 'module'), '组件采用有序的经典脚本');
  assert.ok(scripts.slice(1).every(script => Object.hasOwn(script, 'defer')), '工作台组件均采用 defer');
  const urls = scripts.map(script => new URL(script.src, root));
  assert.ok(urls.every(url => url.protocol === 'file:' && url.href.startsWith(root.href)), '仅加载原型目录内脚本');
  assert.equal(new Set(urls.map(url => url.href)).size, urls.length, '同一脚本只能载入一次');
  assert.equal(urls.at(-1).pathname, new URL('assets/boot.js', root).pathname, '入口初始化须最后加载');

  const document = new Element('document');
  document.innerHTML = html;
  document.createElement = tag => new Element(tag);
  document.getElementById = id => document.querySelector('#' + id);
  document.querySelectorAll = selector => document.children.flatMap(element => [element, ...element.children]).filter(element => matches(element, selector));
  document.body = document.querySelector('body');
  document.head = document.querySelector('head');
  document.activeElement = null;
  const window = new Element('window');
  window.scrollTo = () => {};
  const scheduled = new Map();
  let stored = saved;
  let timerId = 0;
  const schedule = callback => { scheduled.set(++timerId, callback); return timerId; };
  const context = vm.createContext({
    document, FormData, URL, console,
    location: { hash, reload() {} }, window, navigator: {},
    localStorage: { getItem: () => stored || null, setItem: (_, value) => { stored = value; } },
    setTimeout: schedule, setInterval: schedule,
    clearTimeout: id => scheduled.delete(id), clearInterval: id => scheduled.delete(id),
  });
  const run = code => vm.runInContext(code, context);
  if (missingScript) assert.ok(scripts.some(script => script.src === missingScript), '故障注入必须指定真实入口组件');
  for (const url of urls) {
    if (missingScript && url.href === new URL(missingScript, root).href) dispatch('error', new Element('script', { src: missingScript }), {}, window);
    else vm.runInContext(readFileSync(url, 'utf8'), context, { filename: url.pathname });
  }
  dispatch('DOMContentLoaded', document);
  if (!missingScript) assert.equal(run('prototypeLoading.ready'), true, '实际 boot 脚本必须完成初始化');

  function dispatch(type, target, extra = {}, surface = document) {
    let stopped = false;
    const event = { target, preventDefault() {}, stopImmediatePropagation() { stopped = true; }, ...extra };
    for (const { callback } of [...(surface.listeners.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
      callback(event);
      if (stopped) break;
    }
  }
  return {
    run, document, saved: () => stored,
    html: id => document.getElementById(id).innerHTML,
    click(action, data = {}) { dispatch('click', new Element('button', { 'data-action': action, ...Object.fromEntries(Object.entries(data).map(([key, value]) => ['data-' + key, String(value)])) })); },
    submit(kind, values, { id, submitter } = {}) {
      const form = new Element('form', { 'data-form': kind, ...(id ? { 'data-id': id } : {}) });
      form.values = values;
      dispatch('submit', form, { submitter: submitter ? { value: submitter } : undefined });
    },
  };
}
