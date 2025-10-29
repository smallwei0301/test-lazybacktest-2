const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function runTest(name, fn) {
  try {
    fn();
    console.log(`\u2713 ${name}`);
  } catch (error) {
    console.error(`\u2717 ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function createDomStub() {
  const elementsById = new Map();

  class FakeEvent {
    constructor(type) {
      this.type = type;
    }
  }

  class FakeElement {
    constructor(doc, tagName) {
      this.ownerDocument = doc;
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.parentNode = null;
      this._id = null;
      this.className = '';
      this.textContent = '';
      this.style = {};
      this._innerHTML = '';
      this._listeners = {};
    }

    appendChild(child) {
      if (!child) return child;
      child.parentNode = this;
      this.children.push(child);
      return child;
    }

    set innerHTML(value) {
      this._innerHTML = value;
      this.children = [];
    }

    get innerHTML() {
      return this._innerHTML;
    }

    set id(value) {
      if (this._id && elementsById.get(this._id) === this) {
        elementsById.delete(this._id);
      }
      this._id = value;
      if (value) {
        elementsById.set(value, this);
      }
    }

    get id() {
      return this._id;
    }

    addEventListener(type, handler) {
      if (!this._listeners[type]) {
        this._listeners[type] = [];
      }
      this._listeners[type].push(handler);
    }

    dispatchEvent(event) {
      const handlers = this._listeners[event.type] || [];
      handlers.forEach((handler) => handler.call(this, event));
      return true;
    }
  }

  class FakeInputElement extends FakeElement {
    constructor(doc) {
      super(doc, 'input');
      this.type = 'text';
      this.value = '';
      this.checked = false;
      this.min = undefined;
      this.max = undefined;
      this.step = undefined;
    }
  }

  class FakeSelectElement extends FakeElement {
    constructor(doc) {
      super(doc, 'select');
      this.value = '';
      this.disabled = false;
      this.title = '';
    }

    appendChild(child) {
      super.appendChild(child);
      if (this.value === '' && child && child.value !== undefined) {
        this.value = child.value;
      }
      return child;
    }
  }

  class FakeOptionElement extends FakeElement {
    constructor(doc) {
      super(doc, 'option');
      this.value = '';
    }
  }

  class FakeDocument {
    constructor() {
      this.elementsById = elementsById;
    }

    createElement(tag) {
      const lower = tag.toLowerCase();
      switch (lower) {
        case 'input':
          return new FakeInputElement(this);
        case 'select':
          return new FakeSelectElement(this);
        case 'option':
          return new FakeOptionElement(this);
        default:
          return new FakeElement(this, tag);
      }
    }

    getElementById(id) {
      return elementsById.get(id) || null;
    }
  }

  const document = new FakeDocument();
  return {
    document,
    HTMLInputElement: FakeInputElement,
    HTMLSelectElement: FakeSelectElement,
    Event: FakeEvent,
  };
}

function loadModule() {
  const filePath = path.join(__dirname, '..', 'js', 'lib', 'strategy-param-form.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const dom = createDomStub();
  const context = {
    window: {},
    document: dom.document,
    console,
    strategyDescriptions: {
      sample_strategy: {
        defaultParams: { period: 14, enabled: true, label: 'foo', mode: 'fast' },
        paramsSchema: {
          type: 'object',
          properties: {
            period: { type: 'integer', minimum: 1, maximum: 100, default: 14 },
            enabled: { type: 'boolean', default: true },
            label: { type: 'string', default: 'foo' },
            mode: { type: 'string', enum: ['fast', 'slow'], default: 'fast' },
          },
        },
      },
    },
    HTMLInputElement: dom.HTMLInputElement,
    HTMLSelectElement: dom.HTMLSelectElement,
    Event: dom.Event,
  };
  context.window.document = context.document;
  context.window.console = console;
  context.window.strategyDescriptions = context.strategyDescriptions;
  context.window.HTMLInputElement = dom.HTMLInputElement;
  context.window.HTMLSelectElement = dom.HTMLSelectElement;
  context.window.Event = dom.Event;
  context.globalThis = context;
  const script = new vm.Script(code, { filename: 'strategy-param-form.js' });
  const ctx = vm.createContext(context);
  script.runInContext(ctx);
  const api = ctx.window.lazybacktestStrategyParamForm || ctx.lazybacktestStrategyParamForm;
  return { api, dom };
}

runTest('normalizeParamValue clamps numbers to schema bounds', () => {
  const { api } = loadModule();
  const normalize = api.__test__.normalizeParamValue;
  const descriptor = { type: 'number', minimum: 10, maximum: 30 };
  assert.strictEqual(normalize(descriptor, 5), 10);
  assert.strictEqual(normalize(descriptor, 50), 30);
  assert.strictEqual(normalize(descriptor, '18.5'), 18.5);
});

runTest('normalizeParamValue respects enum defaults', () => {
  const { api } = loadModule();
  const normalize = api.__test__.normalizeParamValue;
  const descriptor = { type: 'string', enum: ['fast', 'slow'], default: 'fast' };
  assert.strictEqual(normalize(descriptor, 'slow'), 'slow');
  assert.strictEqual(normalize(descriptor, 'medium'), 'fast');
});

runTest('createSchemaFromDefaults infers primitive types', () => {
  const { api } = loadModule();
  const createSchema = api.__test__.createSchemaFromDefaults;
  const schema = createSchema('sample_strategy', {
    period: 20,
    threshold: 70.5,
    enabled: false,
    alias: 'demo',
  });
  assert.strictEqual(schema.type, 'object');
  assert.deepStrictEqual(Object.keys(schema.properties).sort(), ['alias', 'enabled', 'period', 'threshold']);
  assert.strictEqual(schema.properties.period.type, 'integer');
  assert.strictEqual(schema.properties.threshold.type, 'number');
  assert.strictEqual(schema.properties.enabled.type, 'boolean');
  assert.strictEqual(schema.properties.alias.type, 'string');
});

runTest('createField handles boolean interactions', () => {
  const { api } = loadModule();
  let lastValue = null;
  const field = api.createField({
    role: 'entry',
    strategyId: 'sample_strategy',
    paramName: 'enabled',
    descriptor: { type: 'boolean', default: false },
    value: false,
    onChange: (value) => {
      lastValue = value;
    },
  });
  assert.strictEqual(field.control.checked, false);
  field.setValue(true);
  assert.strictEqual(field.control.checked, true);
  assert.strictEqual(field.getValue(), true);
  assert.strictEqual(lastValue, true);
  field.setValue('false');
  assert.strictEqual(field.control.checked, false);
  assert.strictEqual(field.getValue(), false);
  assert.strictEqual(lastValue, false);
});

runTest('createField ensures enum selections stay valid', () => {
  const { api, dom } = loadModule();
  const field = api.createField({
    role: 'entry',
    strategyId: 'sample_strategy',
    paramName: 'mode',
    descriptor: { type: 'string', enum: ['fast', 'slow'], default: 'fast' },
    value: 'fast',
  });
  assert.strictEqual(field.control.value, 'fast');
  field.control.value = 'medium';
  field.control.dispatchEvent(new dom.Event('change'));
  assert.strictEqual(field.control.value, 'fast');
  field.setValue('slow');
  assert.strictEqual(field.control.value, 'slow');
  assert.strictEqual(field.getValue(), 'slow');
});

runTest('createField clamps numeric input on user change', () => {
  const { api, dom } = loadModule();
  const field = api.createField({
    role: 'entry',
    strategyId: 'sample_strategy',
    paramName: 'period',
    descriptor: { type: 'integer', minimum: 5, maximum: 30, default: 10 },
    value: 10,
  });
  field.control.value = '100';
  field.control.dispatchEvent(new dom.Event('change'));
  assert.strictEqual(field.control.value, '30');
  field.control.value = '0';
  field.control.dispatchEvent(new dom.Event('change'));
  assert.strictEqual(field.control.value, '5');
});

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
