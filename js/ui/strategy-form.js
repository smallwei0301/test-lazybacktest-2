// Patch Tag: LB-STRATEGY-FORM-20250914A
(function initLazybacktestStrategyForm(root) {
    const globalScope = root || (typeof self !== 'undefined' ? self : this);
    if (!globalScope) {
        return;
    }

    const VERSION = 'LB-STRATEGY-FORM-20250914A';
    const existing = globalScope.lazybacktestStrategyForm;
    if (existing && typeof existing.__version__ === 'string' && existing.__version__ >= VERSION) {
        return;
    }

    const registryMetaIndex = new Map();
    const roleStateIndex = new Map();
    const listeners = new Set();
    let initialized = false;
    let readyResolve;
    const readyPromise = new Promise((resolve) => {
        readyResolve = resolve;
    });

    function cloneValue(value) {
        if (value === null || value === undefined) return value;
        if (typeof value !== 'object') return value;
        if (Array.isArray(value)) {
            return value.map((item) => cloneValue(item));
        }
        const clone = {};
        Object.keys(value).forEach((key) => {
            clone[key] = cloneValue(value[key]);
        });
        return clone;
    }

    function ensureRegistry() {
        const registry = globalScope.StrategyPluginRegistry;
        if (!registry || typeof registry.listStrategies !== 'function') {
            throw new Error('[StrategyForm] StrategyPluginRegistry 不可用');
        }
        return registry;
    }

    function loadRegistryMeta() {
        const registry = ensureRegistry();
        const entries = registry.listStrategies({ includeLazy: true }) || [];
        registryMetaIndex.clear();
        entries.forEach((meta) => {
            if (!meta || !meta.id) return;
            registryMetaIndex.set(meta.id, meta);
        });
    }

    function getRegistryMeta(strategyId) {
        if (!registryMetaIndex.has(strategyId)) {
            try {
                loadRegistryMeta();
            } catch (error) {
                console.warn('[StrategyForm] 重新載入策略清單失敗', error);
            }
        }
        return registryMetaIndex.get(strategyId) || null;
    }

    function resolveDefaultParams(strategyId, descriptors) {
        if (!strategyId) return {};
        let defaults = {};
        if (descriptors && typeof descriptors === 'object') {
            const source = descriptors[strategyId];
            if (source && typeof source.defaultParams === 'object') {
                defaults = source.defaultParams;
            }
        }
        if (defaults && typeof defaults === 'object') {
            return JSON.parse(JSON.stringify(defaults));
        }
        const meta = getRegistryMeta(strategyId);
        const schema = meta && meta.paramsSchema ? meta.paramsSchema : null;
        if (!schema || typeof schema !== 'object' || schema.type !== 'object') {
            return {};
        }
        const properties = schema.properties || {};
        const result = {};
        Object.keys(properties).forEach((key) => {
            const descriptor = properties[key];
            if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
                result[key] = descriptor.default;
            }
        });
        return result;
    }

    function normaliseStrategyId(roleConfig, rawId) {
        if (!rawId) return rawId;
        const { normaliseStrategyId: normaliser } = roleConfig;
        if (typeof normaliser === 'function') {
            try {
                const mapped = normaliser(roleConfig.type, rawId);
                if (mapped) {
                    return mapped;
                }
            } catch (error) {
                console.warn('[StrategyForm] 正規化策略 ID 失敗', error);
            }
        }
        return rawId;
    }

    function resolveOptionLabel(strategyId, descriptors) {
        if (!strategyId) return '';
        if (descriptors && descriptors[strategyId] && descriptors[strategyId].name) {
            return descriptors[strategyId].name;
        }
        const meta = getRegistryMeta(strategyId);
        if (meta && meta.label) {
            return meta.label;
        }
        return strategyId;
    }

    function createElement(tagName, options = {}) {
        const el = document.createElement(tagName);
        if (options.className) {
            el.className = options.className;
        }
        if (options.textContent !== undefined) {
            el.textContent = options.textContent;
        }
        if (options.dataset) {
            Object.entries(options.dataset).forEach(([key, value]) => {
                if (value !== undefined) {
                    el.dataset[key] = value;
                }
            });
        }
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                if (value !== undefined) {
                    el.setAttribute(key, value);
                }
            });
        }
        return el;
    }

    function renderParamInput({
        container,
        roleConfig,
        strategyId,
        paramName,
        descriptor,
        presentation,
        value,
        idPrefix,
        onInput,
    }) {
        const wrapper = createElement('div', { className: 'space-y-1' });
        const labelEl = createElement('label', {
            className: 'block text-xs font-medium text-foreground',
            textContent: presentation && presentation.label ? presentation.label : paramName,
        });

        const inputId = idPrefix ? `${idPrefix}${presentation.inputId}` : presentation.inputId;
        labelEl.setAttribute('for', inputId);
        wrapper.appendChild(labelEl);

        const type = descriptor && typeof descriptor.type === 'string' ? descriptor.type : 'number';
        const enumValues = descriptor && Array.isArray(descriptor.enum) ? descriptor.enum : null;
        let inputEl;

        if (enumValues && enumValues.length > 0) {
            inputEl = createElement('select', {
                className: 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm',
                attributes: { id: inputId, 'data-role': roleConfig.type, 'data-param': paramName },
            });
            enumValues.forEach((item) => {
                const option = createElement('option', { textContent: String(item) });
                option.value = String(item);
                inputEl.appendChild(option);
            });
            if (value !== undefined) {
                inputEl.value = String(value);
            }
            inputEl.addEventListener('change', (event) => {
                onInput(paramName, event.target.value);
            });
        } else if (type === 'boolean') {
            inputEl = createElement('input', {
                className: 'h-4 w-4 text-accent border-border focus:ring-accent',
                attributes: { type: 'checkbox', id: inputId, 'data-role': roleConfig.type, 'data-param': paramName },
            });
            inputEl.checked = Boolean(value);
            inputEl.addEventListener('change', (event) => {
                onInput(paramName, Boolean(event.target.checked));
            });
        } else {
            inputEl = createElement('input', {
                className: 'w-full px-3 py-2 border border-border rounded-md shadow-sm text-sm focus:ring-accent focus:border-accent bg-input text-foreground',
                attributes: { type: 'number', id: inputId, 'data-role': roleConfig.type, 'data-param': paramName },
            });
            if (type === 'integer') {
                inputEl.step = descriptor && descriptor.multipleOf ? descriptor.multipleOf : 1;
            } else if (descriptor && descriptor.multipleOf) {
                inputEl.step = descriptor.multipleOf;
            } else {
                inputEl.step = descriptor && descriptor.type === 'number' ? '0.0001' : '1';
            }
            if (descriptor && Number.isFinite(descriptor.minimum)) {
                inputEl.min = descriptor.minimum;
            }
            if (descriptor && Number.isFinite(descriptor.maximum)) {
                inputEl.max = descriptor.maximum;
            }
            if (value !== undefined && value !== null && value !== '') {
                inputEl.value = String(value);
            } else if (descriptor && descriptor.default !== undefined) {
                inputEl.value = String(descriptor.default);
            }
            inputEl.addEventListener('input', (event) => {
                const raw = event.target.value;
                if (raw === '') {
                    onInput(paramName, null);
                    return;
                }
                const numeric = Number(raw);
                if (Number.isFinite(numeric)) {
                    onInput(paramName, numeric);
                }
            });
        }

        wrapper.appendChild(inputEl);
        container.appendChild(wrapper);
    }

    function buildParamController(roleConfig, strategyId, container, options) {
        const { descriptors, resolveParamPresentation, idPrefix, initialParams, onChange } = options || {};
        const meta = getRegistryMeta(strategyId);
        const schema = meta && meta.paramsSchema ? meta.paramsSchema : null;
        const params = {};
        const onInput = (name, value) => {
            params[name] = value !== null && value !== undefined ? value : null;
            if (typeof onChange === 'function') {
                onChange(cloneValue(params));
            }
        };

        container.innerHTML = '';
        if (!schema || typeof schema !== 'object' || schema.type !== 'object') {
            return {
                getValues: () => ({}),
                setValues: () => {},
            };
        }

        const properties = schema.properties || {};
        Object.keys(properties).forEach((paramName) => {
            const descriptor = properties[paramName] || {};
            const presentation = resolveParamPresentation(roleConfig.type, strategyId, paramName);
            const resolvedDefaults = initialParams && Object.prototype.hasOwnProperty.call(initialParams, paramName)
                ? initialParams[paramName]
                : resolveDefaultParams(strategyId, descriptors)[paramName];
            const currentValue = initialParams && Object.prototype.hasOwnProperty.call(initialParams, paramName)
                ? initialParams[paramName]
                : resolvedDefaults;
            params[paramName] = currentValue !== undefined ? currentValue : null;
            renderParamInput({
                container,
                roleConfig,
                strategyId,
                paramName,
                descriptor,
                presentation,
                value: currentValue,
                idPrefix,
                onInput,
            });
        });

        return {
            getValues: () => {
                const output = {};
                Object.keys(properties).forEach((name) => {
                    if (params[name] !== null && params[name] !== undefined) {
                        output[name] = params[name];
                    }
                });
                return output;
            },
            setValues: (nextValues) => {
                if (!nextValues || typeof nextValues !== 'object') {
                    return;
                }
                Object.keys(properties).forEach((name) => {
                    if (Object.prototype.hasOwnProperty.call(nextValues, name)) {
                        params[name] = nextValues[name];
                    }
                });
            },
        };
    }

    function createRoleState(roleConfig, descriptors) {
        const selectEl = document.getElementById(roleConfig.selectId);
        if (!selectEl) {
            throw new Error(`[StrategyForm] 找不到策略下拉元件 ${roleConfig.selectId}`);
        }
        const paramsContainer = document.getElementById(roleConfig.paramsContainerId);
        if (!paramsContainer) {
            throw new Error(`[StrategyForm] 找不到參數容器 ${roleConfig.paramsContainerId}`);
        }
        const dslContainer = document.getElementById(roleConfig.dslContainerId);
        if (!dslContainer) {
            throw new Error(`[StrategyForm] 找不到 DSL 容器 ${roleConfig.dslContainerId}`);
        }

        const state = {
            roleConfig,
            selectEl,
            paramsContainer,
            dslContainer,
            descriptors,
            options: [],
            controller: null,
            selectedStrategyId: null,
            paramsSnapshot: {},
            dslTree: null,
            nodeCounter: 0,
        };

        roleStateIndex.set(roleConfig.type, state);
        return state;
    }

    function normaliseParamsSnapshot(controller) {
        if (!controller) return {};
        const values = controller.getValues();
        if (!values || typeof values !== 'object') return {};
        const snapshot = {};
        Object.keys(values).forEach((key) => {
            const value = values[key];
            if (value !== undefined && value !== null) {
                snapshot[key] = value;
            }
        });
        return snapshot;
    }

    function notifyListeners() {
        const payload = getStateSnapshot();
        listeners.forEach((listener) => {
            try {
                listener(payload);
            } catch (error) {
                console.warn('[StrategyForm] listener 執行失敗', error);
            }
        });
    }

    function renderDslPlaceholder(roleState) {
        const placeholder = createElement('div', {
            className: 'text-[11px] text-muted',
            textContent: '尚未建立策略 DSL 組合，將使用單一策略設定。',
        });
        roleState.dslContainer.innerHTML = '';
        roleState.dslContainer.appendChild(placeholder);
    }

    function createDslNode(roleState, partial) {
        roleState.nodeCounter += 1;
        const base = {
            id: roleState.nodeCounter,
            type: 'plugin',
            strategyId: roleState.selectedStrategyId,
            params: cloneValue(roleState.paramsSnapshot),
            children: [],
        };
        return Object.assign(base, partial || {});
    }

    function ensureDslTree(roleState) {
        if (!roleState.dslTree) {
            roleState.dslTree = createDslNode(roleState, {});
        }
    }

    function renderDslNode(roleState, node, depth, parentNode) {
        const nodeWrapper = createElement('div', {
            className: `border border-border rounded-lg p-3 space-y-2 ${depth > 0 ? 'mt-2 ml-3' : ''}`,
            dataset: { nodeId: String(node.id) },
        });

        if (node.type === 'plugin') {
            const header = createElement('div', { className: 'flex items-center justify-between gap-2' });
            const strategySelect = createElement('select', {
                className: 'flex-1 px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm',
                attributes: { 'data-node-id': node.id, 'data-role': roleState.roleConfig.type },
            });
            roleState.options.forEach((option) => {
                const opt = createElement('option', { textContent: option.label });
                opt.value = option.id;
                strategySelect.appendChild(opt);
            });
            strategySelect.value = node.strategyId || roleState.selectedStrategyId || (roleState.options[0] && roleState.options[0].id) || '';
            strategySelect.addEventListener('change', (event) => {
                const { value } = event.target;
                node.strategyId = value;
                node.params = resolveDefaultParams(value, roleState.descriptors);
                renderDsl(roleState);
                notifyListeners();
            });

            const deleteBtn = createElement('button', {
                className: 'text-xs px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
                textContent: parentNode ? '刪除' : '清除',
                attributes: { type: 'button' },
            });
            deleteBtn.addEventListener('click', () => {
                if (parentNode) {
                    parentNode.children = parentNode.children.filter((child) => child !== node);
                    if (parentNode.type === 'not' && parentNode.children.length > 1) {
                        parentNode.children = parentNode.children.slice(0, 1);
                    }
                    if (parentNode.children.length === 0) {
                        parentNode.children = [];
                    }
                } else {
                    roleState.dslTree = null;
                }
                renderDsl(roleState);
                notifyListeners();
            });

            header.appendChild(strategySelect);
            header.appendChild(deleteBtn);
            nodeWrapper.appendChild(header);

            const paramsContainer = createElement('div', { className: 'mt-2 space-y-2' });
            const controller = buildParamController(
                roleState.roleConfig,
                node.strategyId,
                paramsContainer,
                {
                    descriptors: roleState.descriptors,
                    resolveParamPresentation: roleState.resolveParamPresentation,
                    idPrefix: `dsl${roleState.roleConfig.type}${node.id}`,
                    initialParams: node.params,
                    onChange: (nextParams) => {
                        node.params = nextParams;
                        notifyListeners();
                    },
                },
            );
            node.params = controller.getValues();
            nodeWrapper.appendChild(paramsContainer);
        } else {
            const header = createElement('div', { className: 'flex items-center justify-between gap-2' });
            const typeSelect = createElement('select', {
                className: 'flex-1 px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm',
            });
            const options = [
                { value: 'and', label: 'AND（全部成立）' },
                { value: 'or', label: 'OR（任一成立）' },
                { value: 'not', label: 'NOT（反向）' },
            ];
            options.forEach((opt) => {
                const optionEl = createElement('option', { textContent: opt.label });
                optionEl.value = opt.value;
                typeSelect.appendChild(optionEl);
            });
            typeSelect.value = node.type;
            typeSelect.addEventListener('change', (event) => {
                const nextType = event.target.value;
                node.type = nextType;
                if (nextType === 'not' && node.children.length > 1) {
                    node.children = node.children.slice(0, 1);
                }
                renderDsl(roleState);
                notifyListeners();
            });

            const deleteBtn = createElement('button', {
                className: 'text-xs px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
                textContent: parentNode ? '刪除群組' : '清除',
                attributes: { type: 'button' },
            });
            deleteBtn.addEventListener('click', () => {
                if (parentNode) {
                    parentNode.children = parentNode.children.filter((child) => child !== node);
                    if (parentNode.children.length === 0) {
                        parentNode.children = [];
                    }
                } else {
                    roleState.dslTree = null;
                }
                renderDsl(roleState);
                notifyListeners();
            });

            header.appendChild(typeSelect);
            header.appendChild(deleteBtn);
            nodeWrapper.appendChild(header);

            const childrenContainer = createElement('div', { className: 'pl-2 border-l border-dashed border-border space-y-2' });
            node.children.forEach((child) => {
                const renderedChild = renderDslNode(roleState, child, depth + 1, node);
                childrenContainer.appendChild(renderedChild);
            });
            nodeWrapper.appendChild(childrenContainer);

            const actionRow = createElement('div', { className: 'flex flex-wrap gap-2 pt-2' });
            const addPluginBtn = createElement('button', {
                className: 'text-xs px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
                textContent: '新增規則',
                attributes: { type: 'button' },
            });
            addPluginBtn.addEventListener('click', () => {
                const newNode = createDslNode(roleState, {});
                newNode.strategyId = roleState.selectedStrategyId || (roleState.options[0] && roleState.options[0].id) || '';
                newNode.params = cloneValue(roleState.paramsSnapshot || {});
                node.children.push(newNode);
                if (node.type === 'not' && node.children.length > 1) {
                    node.children = node.children.slice(0, 1);
                }
                renderDsl(roleState);
                notifyListeners();
            });

            const addGroupBtn = createElement('button', {
                className: 'text-xs px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
                textContent: '新增群組',
                attributes: { type: 'button' },
            });
            addGroupBtn.addEventListener('click', () => {
                const newGroup = createDslNode(roleState, { type: 'and', params: undefined, children: [] });
                node.children.push(newGroup);
                renderDsl(roleState);
                notifyListeners();
            });

            actionRow.appendChild(addPluginBtn);
            actionRow.appendChild(addGroupBtn);
            nodeWrapper.appendChild(actionRow);
        }

        return nodeWrapper;
    }

    function renderDsl(roleState) {
        if (!roleState.dslTree) {
            renderDslPlaceholder(roleState);
            return;
        }
        roleState.dslContainer.innerHTML = '';
        const treeEl = renderDslNode(roleState, roleState.dslTree, 0, null);
        roleState.dslContainer.appendChild(treeEl);
    }

    function resetDsl(roleType) {
        const roleState = roleStateIndex.get(roleType);
        if (!roleState) return;
        roleState.dslTree = null;
        renderDsl(roleState);
        notifyListeners();
    }

    function applySelection(roleState, strategyId) {
        const normalised = normaliseStrategyId(roleState.roleConfig, strategyId);
        roleState.selectedStrategyId = normalised;
        if (roleState.selectEl.value !== normalised) {
            roleState.selectEl.value = normalised;
        }
        const defaults = resolveDefaultParams(normalised, roleState.descriptors);
        roleState.paramsSnapshot = defaults;
        roleState.controller = buildParamController(
            roleState.roleConfig,
            normalised,
            roleState.paramsContainer,
            {
                descriptors: roleState.descriptors,
                resolveParamPresentation: roleState.resolveParamPresentation,
                idPrefix: '',
                initialParams: defaults,
                onChange: (nextParams) => {
                    roleState.paramsSnapshot = nextParams;
                    notifyListeners();
                },
            },
        );
        roleState.paramsSnapshot = roleState.controller.getValues();
        renderDsl(roleState);
    }

    function populateOptions(roleState, candidateList) {
        roleState.options = [];
        roleState.selectEl.innerHTML = '';

        candidateList.forEach((candidate) => {
            const strategyId = normaliseStrategyId(roleState.roleConfig, candidate.strategyId || candidate.id || candidate);
            const label = resolveOptionLabel(strategyId, roleState.descriptors);
            roleState.options.push({ id: strategyId, label });
        });

        roleState.options.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));

        roleState.options.forEach((option) => {
            const optionEl = createElement('option', { textContent: option.label });
            optionEl.value = option.id;
            roleState.selectEl.appendChild(optionEl);
        });
    }

    function resolveCandidateList(roleConfig, candidateCatalog) {
        if (!candidateCatalog) return [];
        if (roleConfig.catalogKey && Array.isArray(candidateCatalog[roleConfig.catalogKey])) {
            return candidateCatalog[roleConfig.catalogKey];
        }
        if (Array.isArray(candidateCatalog[roleConfig.type])) {
            return candidateCatalog[roleConfig.type];
        }
        const fallbackKeys = ['longEntry', 'longExit', 'shortEntry', 'shortExit'];
        for (const key of fallbackKeys) {
            if (Array.isArray(candidateCatalog[key]) && key === roleConfig.catalogKey) {
                return candidateCatalog[key];
            }
        }
        return [];
    }

    function initialiseRole(roleConfig, descriptors, candidateCatalog) {
        const roleState = createRoleState(roleConfig, descriptors);
        roleState.resolveParamPresentation = roleConfig.resolveParamPresentation;
        const candidates = resolveCandidateList(roleConfig, candidateCatalog);
        populateOptions(roleState, candidates);
        const defaultOption = roleState.options[0] ? roleState.options[0].id : null;
        applySelection(roleState, defaultOption);

        roleState.selectEl.addEventListener('change', (event) => {
            applySelection(roleState, event.target.value);
            notifyListeners();
        });

        const controls = createElement('div', { className: 'flex flex-wrap gap-2 mt-3' });
        const addNodeBtn = createElement('button', {
            className: 'text-xs px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
            textContent: '以目前策略新增 DSL 規則',
            attributes: { type: 'button' },
        });
        addNodeBtn.addEventListener('click', () => {
            ensureDslTree(roleState);
            if (roleState.dslTree) {
                roleState.dslTree.strategyId = roleState.selectedStrategyId;
                roleState.dslTree.params = cloneValue(roleState.paramsSnapshot);
            }
            renderDsl(roleState);
            notifyListeners();
        });

        const addGroupBtn = createElement('button', {
            className: 'text-xs px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
            textContent: '建立 AND 群組',
            attributes: { type: 'button' },
        });
        addGroupBtn.addEventListener('click', () => {
            const seed = createDslNode(roleState, {
                type: 'and',
                strategyId: undefined,
                params: undefined,
                children: [createDslNode(roleState, {})],
            });
            roleState.dslTree = seed;
            renderDsl(roleState);
            notifyListeners();
        });

        const addOrBtn = createElement('button', {
            className: 'text-xs px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
            textContent: '建立 OR 群組',
            attributes: { type: 'button' },
        });
        addOrBtn.addEventListener('click', () => {
            const seed = createDslNode(roleState, {
                type: 'or',
                strategyId: undefined,
                params: undefined,
                children: [createDslNode(roleState, {})],
            });
            roleState.dslTree = seed;
            renderDsl(roleState);
            notifyListeners();
        });

        const clearBtn = createElement('button', {
            className: 'text-xs px-2 py-1 border border-destructive text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors',
            textContent: '清除 DSL 組合',
            attributes: { type: 'button' },
        });
        clearBtn.addEventListener('click', () => {
            resetDsl(roleState.roleConfig.type);
        });

        controls.appendChild(addNodeBtn);
        controls.appendChild(addGroupBtn);
        controls.appendChild(addOrBtn);
        controls.appendChild(clearBtn);
        roleState.dslContainer.parentElement && roleState.dslContainer.parentElement.appendChild(controls);

        renderDsl(roleState);
    }

    function sanitiseDslNode(node) {
        if (!node || typeof node !== 'object') return null;
        if (node.type === 'plugin') {
            if (!node.strategyId) return null;
            const payload = { type: 'plugin', id: node.strategyId };
            if (node.params && typeof node.params === 'object' && Object.keys(node.params).length > 0) {
                payload.params = cloneValue(node.params);
            }
            return payload;
        }
        const children = Array.isArray(node.children) ? node.children.map((child) => sanitiseDslNode(child)).filter(Boolean) : [];
        if (children.length === 0) return null;
        return { type: node.type, children };
    }

    function applyDsl(roleType, dsl) {
        const roleState = roleStateIndex.get(roleType);
        if (!roleState) return;
        if (!dsl || typeof dsl !== 'object') {
            roleState.dslTree = null;
            renderDsl(roleState);
            notifyListeners();
            return;
        }

        function hydrate(node) {
            if (!node || typeof node !== 'object') return null;
            if (node.type === 'plugin') {
                return createDslNode(roleState, {
                    strategyId: normaliseStrategyId(roleState.roleConfig, node.id || node.strategyId || node.pluginId),
                    params: cloneValue(node.params || {}),
                });
            }
            const children = Array.isArray(node.children) ? node.children.map((child) => hydrate(child)).filter(Boolean) : [];
            if (children.length === 0) return null;
            return createDslNode(roleState, { type: node.type, children, strategyId: undefined, params: undefined });
        }

        const hydrated = hydrate(dsl);
        roleState.dslTree = hydrated;
        renderDsl(roleState);
        notifyListeners();
    }

    function getStateSnapshot() {
        const snapshot = {};
        roleStateIndex.forEach((roleState, roleType) => {
            snapshot[roleType] = {
                strategyId: roleState.selectedStrategyId,
                params: cloneValue(roleState.paramsSnapshot),
                dsl: sanitiseDslNode(roleState.dslTree),
            };
        });
        return snapshot;
    }

    function applyStateSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;
        roleStateIndex.forEach((roleState, roleType) => {
            const state = snapshot[roleType];
            if (!state) {
                return;
            }
            if (state.strategyId) {
                applySelection(roleState, state.strategyId);
            }
            if (state.params && roleState.controller) {
                roleState.paramsSnapshot = cloneValue(state.params);
                roleState.controller = buildParamController(
                    roleState.roleConfig,
                    roleState.selectedStrategyId,
                    roleState.paramsContainer,
                    {
                        descriptors: roleState.descriptors,
                        resolveParamPresentation: roleState.resolveParamPresentation,
                        idPrefix: '',
                        initialParams: state.params,
                        onChange: (nextParams) => {
                            roleState.paramsSnapshot = nextParams;
                            notifyListeners();
                        },
                    },
                );
                roleState.paramsSnapshot = roleState.controller.getValues();
            }
            if (state.dsl) {
                applyDsl(roleType, state.dsl);
            } else {
                renderDsl(roleState);
            }
        });
        notifyListeners();
    }

    function init(config) {
        if (initialized) {
            return readyPromise;
        }
        initialized = true;

        if (!config || typeof config !== 'object') {
            throw new Error('[StrategyForm] 初始化參數不可為空');
        }

        const { roles, descriptors, candidateCatalog, resolveParamPresentation, normaliseStrategyId: normaliser } = config;
        if (!Array.isArray(roles) || roles.length === 0) {
            throw new Error('[StrategyForm] roles 參數不可為空');
        }

        loadRegistryMeta();

        roles.forEach((roleConfig) => {
            const extendedConfig = Object.assign({}, roleConfig, {
                paramsContainerId: roleConfig.paramsContainerId || `${roleConfig.type}Params`,
                dslContainerId: roleConfig.dslContainerId || `${roleConfig.type}Dsl`,
                resolveParamPresentation,
                normaliseStrategyId: normaliser,
            });
            initialiseRole(extendedConfig, descriptors || {}, candidateCatalog || {});
        });

        readyResolve();
        return readyPromise;
    }

    const api = {
        __version__: VERSION,
        init,
        ready: readyPromise,
        onChange(listener) {
            if (typeof listener === 'function') {
                listeners.add(listener);
            }
            return () => listeners.delete(listener);
        },
        getSelection(roleType) {
            const roleState = roleStateIndex.get(roleType);
            return roleState ? roleState.selectedStrategyId : null;
        },
        setSelection(roleType, strategyId) {
            const roleState = roleStateIndex.get(roleType);
            if (!roleState) return;
            applySelection(roleState, strategyId);
            notifyListeners();
        },
        getParams(roleType) {
            const roleState = roleStateIndex.get(roleType);
            if (!roleState) return {};
            return cloneValue(normaliseParamsSnapshot(roleState.controller));
        },
        setParams(roleType, params) {
            const roleState = roleStateIndex.get(roleType);
            if (!roleState || !roleState.controller) return;
            roleState.controller = buildParamController(
                roleState.roleConfig,
                roleState.selectedStrategyId,
                roleState.paramsContainer,
                {
                    descriptors: roleState.descriptors,
                    resolveParamPresentation: roleState.resolveParamPresentation,
                    idPrefix: '',
                    initialParams: params,
                    onChange: (nextParams) => {
                        roleState.paramsSnapshot = nextParams;
                        notifyListeners();
                    },
                },
            );
            roleState.paramsSnapshot = roleState.controller.getValues();
            renderDsl(roleState);
            notifyListeners();
        },
        getDsl(roleType) {
            const roleState = roleStateIndex.get(roleType);
            if (!roleState) return null;
            return sanitiseDslNode(roleState.dslTree);
        },
        setDsl: applyDsl,
        resetDsl,
        getCatalog() {
            const catalog = {};
            roleStateIndex.forEach((roleState, roleType) => {
                catalog[roleType] = roleState.options.map((option) => ({ id: option.id, label: option.label }));
            });
            return catalog;
        },
        getStateSnapshot,
        applyStateSnapshot,
    };

    globalScope.lazybacktestStrategyForm = api;
})(typeof self !== 'undefined' ? self : this);
