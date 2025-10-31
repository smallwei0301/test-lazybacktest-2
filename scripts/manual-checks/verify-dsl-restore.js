#!/usr/bin/env node
// Patch Tag: LB-STRATEGY-FORM-20260930A
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL, fileURLToPath } = require('url');

class Element {
    constructor(tagName, ownerDocument) {
        this.ownerDocument = ownerDocument;
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.attributes = {};
        this.style = {};
        this.dataset = {};
        let classSet = new Set();
        const applyClassMutation = () => {
            const classString = Array.from(classSet).join(' ');
            this._classCache = classString;
            this.attributes.class = classString;
        };
        Object.defineProperty(this, 'className', {
            get() {
                return this._classCache || Array.from(classSet).join(' ');
            },
            set(value) {
                const entries = String(value || '')
                    .split(/\s+/)
                    .map((token) => token.trim())
                    .filter(Boolean);
                classSet = new Set(entries);
                applyClassMutation();
            },
        });
        this.classList = {
            add: (...tokens) => {
                let mutated = false;
                tokens
                    .map((token) => String(token || '').trim())
                    .filter(Boolean)
                    .forEach((token) => {
                        if (!classSet.has(token)) {
                            classSet.add(token);
                            mutated = true;
                        }
                    });
                if (mutated) {
                    applyClassMutation();
                }
            },
            remove: (...tokens) => {
                let mutated = false;
                tokens
                    .map((token) => String(token || '').trim())
                    .filter(Boolean)
                    .forEach((token) => {
                        if (classSet.delete(token)) {
                            mutated = true;
                        }
                    });
                if (mutated) {
                    applyClassMutation();
                }
            },
            contains: (token) => classSet.has(String(token || '').trim()),
            toggle: (token, force) => {
                const entry = String(token || '').trim();
                if (!entry) {
                    return false;
                }
                if (force === true) {
                    classSet.add(entry);
                    applyClassMutation();
                    return true;
                }
                if (force === false) {
                    classSet.delete(entry);
                    applyClassMutation();
                    return false;
                }
                if (classSet.has(entry)) {
                    classSet.delete(entry);
                    applyClassMutation();
                    return false;
                }
                classSet.add(entry);
                applyClassMutation();
                return true;
            },
            toString: () => Array.from(classSet).join(' '),
        };
        this.className = '';
        this.textContent = '';
        this.innerHTML = '';
        this.value = '';
        this.checked = false;
        this.id = null;
        this.options = [];
        this._listeners = new Map();
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        if (child.tagName === 'OPTION' && this.tagName === 'SELECT') {
            this.options.push(child);
        }
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
        }
        if (this.tagName === 'SELECT') {
            const optIdx = this.options.indexOf(child);
            if (optIdx !== -1) {
                this.options.splice(optIdx, 1);
            }
        }
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
            this.parentNode = null;
        }
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'id') {
            this.id = String(value);
            this.ownerDocument._registerElement(this);
        }
        if (name.startsWith('data-')) {
            const dataKey = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            this.dataset[dataKey] = String(value);
        }
    }

    addEventListener(type, handler) {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, []);
        }
        this._listeners.get(type).push(handler);
    }

    dispatchEvent(event) {
        const type = event && event.type ? event.type : String(event);
        const listeners = this._listeners.get(type) || [];
        listeners.forEach((handler) => {
            handler.call(this, event);
        });
    }

    querySelector(selector) {
        if (typeof selector !== 'string') {
            return null;
        }
        if (selector.startsWith('[data-')) {
            const match = selector.match(/^\[data-([a-z0-9-]+)(?:="([^\"]*)")?\]$/i);
            if (!match) {
                return null;
            }
            const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            const expected = match[2];
            const queue = [this];
            while (queue.length) {
                const node = queue.shift();
                if (node && node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, key)) {
                    if (expected === undefined || String(node.dataset[key]) === expected) {
                        return node;
                    }
                }
                if (node && Array.isArray(node.children) && node.children.length) {
                    queue.push(...node.children);
                }
            }
            return null;
        }
        return null;
    }
}

class Document {
    constructor() {
        this._elementsById = new Map();
        this._listeners = new Map();
        this.currentScript = null;
        this.baseURI = '';
    }

    createElement(tagName) {
        return new Element(tagName, this);
    }

    getElementById(id) {
        return this._elementsById.get(id) || null;
    }

    _registerElement(element) {
        if (element.id) {
            this._elementsById.set(element.id, element);
        }
    }

    addEventListener(type, handler) {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, []);
        }
        this._listeners.get(type).push(handler);
    }

    dispatchEvent(type) {
        const listeners = this._listeners.get(type) || [];
        listeners.forEach((handler) => handler());
    }

    getElementsByTagName(tagName) {
        if (tagName.toLowerCase() === 'script' && this.currentScript) {
            return [this.currentScript];
        }
        return [];
    }
}

function createGlobalSandbox(rootDir) {
    const document = new Document();
    const window = {
        document,
        console,
        Map,
        Set,
        WeakMap,
        WeakSet,
        Object,
        Array,
        Number,
        String,
        Boolean,
        Math,
        Date,
        JSON,
        RegExp,
        Intl,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        location: { href: pathToFileURL(path.join(rootDir, 'index.html')).href },
    };
    document.baseURI = window.location.href;

    function normalizeUrl(url) {
        try {
            const resolved = new URL(url, document.currentScript ? document.currentScript.src : window.location.href);
            if (resolved.protocol === 'file:') {
                return fileURLToPath(resolved);
            }
            return resolved.pathname;
        } catch (error) {
            return path.resolve(rootDir, url);
        }
    }

    class LocalXMLHttpRequest {
        open(method, url) {
            this.method = method;
            this.url = url;
            this.status = 0;
            this.responseText = '';
        }

        overrideMimeType() {}

        send() {
            try {
                const filePath = normalizeUrl(this.url);
                this.responseText = fs.readFileSync(filePath, 'utf8');
                this.status = 200;
            } catch (error) {
                this.status = 404;
                this.responseText = '';
                throw error;
            }
        }
    }

    function importScriptsShim(...urls) {
        urls.forEach((url) => {
            const filePath = normalizeUrl(url);
            const code = fs.readFileSync(filePath, 'utf8');
            vm.runInContext(code, sandbox);
        });
    }

    const sandbox = vm.createContext({
        window,
        document,
        console,
        Map,
        Set,
        WeakMap,
        WeakSet,
        Object,
        Array,
        Number,
        String,
        Boolean,
        Math,
        Date,
        JSON,
        RegExp,
        Intl,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        setTimeout: window.setTimeout,
        clearTimeout: window.clearTimeout,
        XMLHttpRequest: LocalXMLHttpRequest,
        importScripts: importScriptsShim,
        self: window,
        globalThis: window,
    });

    window.self = window;
    window.globalThis = window;
    window.XMLHttpRequest = LocalXMLHttpRequest;
    window.importScripts = importScriptsShim;

    return { sandbox, window, document };
}

function createContainers(document) {
    const ids = [
        'entryStrategyControl', 'entryParams', 'entryDslBuilder',
        'exitStrategyControl', 'exitParams', 'exitDslBuilder',
        'shortEntryStrategyControl', 'shortEntryParams', 'shortEntryDslBuilder',
        'shortExitStrategyControl', 'shortExitParams', 'shortExitDslBuilder',
    ];
    ids.forEach((id) => {
        const container = document.createElement('div');
        container.setAttribute('id', id);
        document._registerElement(container);
    });
}

function loadScriptIntoContext(sandbox, scriptPath) {
    const source = fs.readFileSync(scriptPath, 'utf8');
    vm.runInContext(source, sandbox, { filename: scriptPath });
}

function main() {
    const rootDir = path.resolve(__dirname, '..', '..');
    const { sandbox, window, document } = createGlobalSandbox(rootDir);

    createContainers(document);

    const manifestPath = path.join(rootDir, 'js/strategy-plugin-manifest.js');
    document.currentScript = { src: pathToFileURL(manifestPath).href };

    const scripts = [
        'js/strategy-plugin-contract.js',
        'js/strategy-plugin-registry.js',
        'js/strategy-plugin-manifest.js',
        'js/config.js',
        'js/ui/strategy-form.js',
    ];

    scripts.forEach((relativePath) => {
        const scriptPath = path.join(rootDir, relativePath);
        document.currentScript = { src: pathToFileURL(scriptPath).href };
        loadScriptIntoContext(sandbox, scriptPath);
    });

    const readyCallbacks = document._listeners && document._listeners.get('DOMContentLoaded');
    if (Array.isArray(readyCallbacks)) {
        readyCallbacks.forEach((callback) => {
            try {
                callback();
            } catch (error) {
                console.error('初始化策略表單時發生錯誤', error);
            }
        });
    }

    const registry = window.StrategyPluginRegistry;
    if (!registry || typeof registry.listStrategies !== 'function') {
        console.error('StrategyPluginRegistry 未初始化。');
        process.exit(1);
    }
    const metaCount = registry.listStrategies({ includeLazy: true }).length;
    console.log(`已載入策略 meta 數量：${metaCount}`);

    const form = window.lazyStrategyForm;
    if (!form || typeof form.applySettings !== 'function') {
        console.error('lazyStrategyForm 未初始化成功。');
        process.exit(1);
    }

    const sampleSettings = {
        entryStrategy: 'ma_cross',
        entryParams: { shortPeriod: 5, longPeriod: 21 },
        exitStrategy: 'ma_below',
        exitParams: { period: 18 },
        enableShorting: true,
        shortEntryStrategy: 'short_ma_cross',
        shortEntryParams: { shortPeriod: 6, longPeriod: 24 },
        shortExitStrategy: 'cover_ma_cross',
        shortExitParams: { shortPeriod: 7, longPeriod: 25 },
        strategyDsl: {
            longEntry: {
                type: 'AND',
                nodes: [
                    { type: 'plugin', id: 'ma_cross', params: { shortPeriod: 5, longPeriod: 21 } },
                    { type: 'NOT', node: { type: 'plugin', id: 'rsi_oversold', params: { period: 14, threshold: 28 } } },
                ],
            },
            longExit: { type: 'plugin', id: 'ma_below', params: { period: 18 } },
            shortEntry: { type: 'plugin', id: 'short_ma_cross', params: { shortPeriod: 6, longPeriod: 24 } },
            shortExit: { type: 'plugin', id: 'cover_ma_cross', params: { shortPeriod: 7, longPeriod: 25 } },
        },
    };

    form.applySettings(sampleSettings);

    const restoredDsl = form.getDslDefinition({ enableShorting: true });
    const expectedKeys = ['longEntry', 'longExit', 'shortEntry', 'shortExit'];
    const missingKeys = expectedKeys.filter((key) => !restoredDsl[key]);
    if (missingKeys.length > 0) {
        console.error('DSL 還原失敗，缺少節點：', missingKeys.join(', '));
        process.exit(1);
    }

    const roundtrip = form.getDslDefinition({ enableShorting: true });
    const serialized = JSON.stringify(roundtrip);
    const original = JSON.stringify(sampleSettings.strategyDsl);

    if (serialized === original) {
        console.log('✅ DSL 還原檢查通過：重新載入後仍保留策略樹狀結構。');
    } else {
        console.warn('⚠️ DSL 還原結果與原始設定不同，請手動比對：');
        console.warn('原始：', original);
        console.warn('還原：', serialized);
        process.exitCode = 1;
    }

    const paramsCheck = {
        entry: form.getParams('entry'),
        exit: form.getParams('exit'),
        shortEntry: form.getParams('shortEntry'),
        shortExit: form.getParams('shortExit'),
    };
    console.log('表單參數快照：', JSON.stringify(paramsCheck));
    console.log('操作提示：請在瀏覽器儲存策略後重新整理，並確認畫面中 DSL 編輯器狀態與本工具輸出一致。');
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error('手動檢查腳本執行失敗：', error);
        process.exit(1);
    }
}
