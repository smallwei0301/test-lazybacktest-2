// Strategy Form Focus Helpers - LB-STRATEGY-FORM-FOCUS-20260919A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const VERSION = 'LB-STRATEGY-FORM-FOCUS-20260919A';

  function resolveDocument(container, options) {
    if (options && options.document) {
      return options.document;
    }
    if (container && typeof container === 'object' && container.ownerDocument) {
      return container.ownerDocument;
    }
    if (typeof document !== 'undefined') {
      return document;
    }
    return null;
  }

  function captureFocusState(container, options) {
    const doc = resolveDocument(container, options || {});
    if (!container || typeof container.contains !== 'function') {
      return null;
    }
    if (!doc || !doc.activeElement) {
      return null;
    }
    const activeElement = doc.activeElement;
    if (!container.contains(activeElement)) {
      return null;
    }
    const state = {
      id: typeof activeElement.id === 'string' && activeElement.id ? activeElement.id : null,
      paramName:
        activeElement && activeElement.dataset && typeof activeElement.dataset.paramName === 'string'
          ? activeElement.dataset.paramName
          : null,
      isTextInput: false,
      selectionStart: null,
      selectionEnd: null,
    };

    const tagName = typeof activeElement.tagName === 'string' ? activeElement.tagName.toUpperCase() : '';
    const inputType = typeof activeElement.type === 'string' ? activeElement.type.toLowerCase() : '';
    if (tagName === 'INPUT') {
      if (inputType !== 'checkbox' && inputType !== 'radio' && inputType !== 'button') {
        state.isTextInput = true;
      }
    } else if (tagName === 'TEXTAREA' || activeElement.isContentEditable) {
      state.isTextInput = true;
    }

    if (
      state.isTextInput &&
      typeof activeElement.selectionStart === 'number' &&
      typeof activeElement.selectionEnd === 'number'
    ) {
      state.selectionStart = activeElement.selectionStart;
      state.selectionEnd = activeElement.selectionEnd;
    }

    return state;
  }

  function restoreFocusState(container, focusState, options) {
    if (!container || !focusState) {
      return false;
    }
    const doc = resolveDocument(container, options || {});
    if (!doc) {
      return false;
    }
    const contains = typeof container.contains === 'function' ? (node) => container.contains(node) : null;
    let target = null;

    if (focusState.id && typeof doc.getElementById === 'function') {
      const candidate = doc.getElementById(focusState.id);
      if (!candidate) {
        target = null;
      } else if (!contains || contains(candidate)) {
        target = candidate;
      }
    }

    if (!target && focusState.paramName && typeof container.querySelector === 'function') {
      target = container.querySelector(`[data-param-name="${focusState.paramName}"]`);
    }

    if (!target && options && options.fallbackSelector) {
      if (typeof container.querySelector === 'function') {
        target = container.querySelector(options.fallbackSelector);
      }
      if (!target && typeof doc.querySelector === 'function') {
        const candidate = doc.querySelector(options.fallbackSelector);
        if (candidate && (!contains || contains(candidate))) {
          target = candidate;
        }
      }
    }

    if (!target) {
      return false;
    }

    if (typeof target.focus === 'function') {
      try {
        target.focus();
      } catch (error) {
        // ignore focus errors (可能因元素不可聚焦)
      }
    }

    if (
      focusState.isTextInput &&
      typeof focusState.selectionStart === 'number' &&
      typeof focusState.selectionEnd === 'number' &&
      typeof target.setSelectionRange === 'function'
    ) {
      try {
        target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
      } catch (error) {
        // ignore selection errors
      }
    }

    return true;
  }

  const api = Object.freeze({
    __version__: VERSION,
    captureFocusState,
    restoreFocusState,
  });

  if (globalScope && typeof globalScope === 'object') {
    globalScope.lazybacktestFormFocus = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
