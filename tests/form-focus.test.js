const assert = require('assert');
const focusApi = require('../js/lib/strategy-form-focus.js');

const { captureFocusState, restoreFocusState } = focusApi;

function createStubEnvironment() {
    const elements = [];
    const doc = {
        activeElement: null,
        elements,
        getElementById(id) {
            return this.elements.find((el) => el.id === id) || null;
        },
        querySelector(selector) {
            if (!selector) {
                return null;
            }
            if (selector.startsWith('#')) {
                return this.getElementById(selector.slice(1));
            }
            if (selector.startsWith('[data-param-name="')) {
                const key = selector.slice('[data-param-name="'.length, -2);
                return this.elements.find((el) => el.dataset && el.dataset.paramName === key) || null;
            }
            return null;
        },
    };
    const container = {
        ownerDocument: doc,
        contains(node) {
            return this.ownerDocument.elements.includes(node);
        },
        querySelector(selector) {
            return this.ownerDocument.querySelector(selector);
        },
    };
    return { container, document: doc, elements };
}

function createStubElement({ id, paramName, type = 'text', tagName = 'INPUT', selectionStart = null, selectionEnd = null }) {
    return {
        id,
        type,
        tagName,
        dataset: { paramName },
        selectionStart,
        selectionEnd,
        focusCalled: 0,
        selectionRangeSet: false,
        focus() {
            this.focusCalled += 1;
        },
        setSelectionRange(start, end) {
            this.selectionStart = start;
            this.selectionEnd = end;
            this.selectionRangeSet = true;
        },
    };
}

(function runTests() {
    const env = createStubEnvironment();
    const textInput = createStubElement({
        id: 'field-one',
        paramName: 'maPeriod',
        type: 'number',
        selectionStart: 2,
        selectionEnd: 3,
    });
    env.elements.push(textInput);
    env.document.elements.push(textInput);
    env.document.activeElement = textInput;

    const state = captureFocusState(env.container, { document: env.document });
    assert.ok(state, '應該可以擷取焦點狀態');
    assert.strictEqual(state.id, 'field-one');
    assert.strictEqual(state.paramName, 'maPeriod');
    assert.strictEqual(state.selectionStart, 2);
    assert.strictEqual(state.selectionEnd, 3);
    assert.strictEqual(state.isTextInput, true);

    const replacement = createStubElement({ id: 'field-one', paramName: 'maPeriod', type: 'number' });
    env.document.elements.splice(0, env.document.elements.length, replacement);
    env.document.activeElement = null;

    const restored = restoreFocusState(env.container, state, { document: env.document });
    assert.strictEqual(restored, true, '應該成功復原焦點');
    assert.strictEqual(replacement.focusCalled, 1);
    assert.strictEqual(replacement.selectionStart, 2);
    assert.strictEqual(replacement.selectionEnd, 3);
    assert.strictEqual(replacement.selectionRangeSet, true);

    const outsideEnv = createStubEnvironment();
    const outsideElement = createStubElement({ id: 'outside', paramName: 'maPeriod', type: 'text' });
    outsideEnv.document.activeElement = outsideElement;
    const missingState = captureFocusState(outsideEnv.container, { document: outsideEnv.document });
    assert.strictEqual(missingState, null, '容器外的節點不應回傳焦點狀態');

    const noTargetEnv = createStubEnvironment();
    noTargetEnv.document.activeElement = null;
    const restoredMissing = restoreFocusState(noTargetEnv.container, {
        id: 'unknown',
        paramName: 'unknown',
        isTextInput: true,
        selectionStart: 0,
        selectionEnd: 0,
    }, { document: noTargetEnv.document });
    assert.strictEqual(restoredMissing, false, '找不到節點時應回傳 false');

    console.log('strategy-form-focus tests passed');
})();
