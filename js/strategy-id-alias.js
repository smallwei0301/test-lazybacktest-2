// Patch Tag: LB-STRATEGY-ID-ALIAS-20260917A
(function (root, factory) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const exports = factory(globalScope);
  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  }
  if (globalScope) {
    globalScope.LazyStrategyIdHelper = Object.assign(
      {},
      globalScope.LazyStrategyIdHelper,
      exports,
    );
  }
})(
  typeof self !== 'undefined'
    ? self
    : typeof global !== 'undefined'
      ? global
      : undefined,
  function (globalScope) {
    function getStrategyDescriptions(override) {
      if (override && typeof override === 'object') {
        return override;
      }
      if (globalScope && typeof globalScope.strategyDescriptions === 'object') {
        return globalScope.strategyDescriptions;
      }
      return null;
    }

    function isKnownStrategy(id, descriptions) {
      if (!id) return false;
      const map = getStrategyDescriptions(descriptions);
      if (!map) return true;
      return Boolean(map[id]);
    }

    function resolveRoleAlias(id, role, descriptions) {
      if (!id) {
        return { normalized: id, aliasApplied: false, reason: null };
      }
      const map = getStrategyDescriptions(descriptions);
      let normalized = id;
      let reason = null;

      const apply = (candidate, candidateReason) => {
        if (candidate && candidate !== normalized) {
          normalized = candidate;
          reason = candidateReason;
          return true;
        }
        return false;
      };

      if (role === 'entry') {
        if (/_exit$/.test(normalized)) {
          const base = normalized.replace(/_exit$/, '');
          if (isKnownStrategy(base, map) && apply(base, 'strip-exit-suffix')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        if (normalized.startsWith('short_')) {
          const base = normalized.replace(/^short_/, '');
          if (isKnownStrategy(base, map) && apply(base, 'remove-short-prefix')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        if (normalized.startsWith('cover_')) {
          const base = normalized.replace(/^cover_/, '');
          if (isKnownStrategy(base, map) && apply(base, 'remove-cover-prefix')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        return { normalized, aliasApplied: normalized !== id, reason };
      }

      if (role === 'exit') {
        if (!/_exit$/.test(normalized)) {
          const exitCandidate = `${normalized}_exit`;
          if (isKnownStrategy(exitCandidate, map) && apply(exitCandidate, 'append-exit-suffix')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        return { normalized, aliasApplied: normalized !== id, reason };
      }

      if (role === 'shortEntry') {
        if (normalized.startsWith('cover_')) {
          const base = normalized.replace(/^cover_/, '');
          const shortCandidate = `short_${base}`;
          if (isKnownStrategy(shortCandidate, map) && apply(shortCandidate, 'swap-cover-to-short')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        if (!normalized.startsWith('short_')) {
          const shortCandidate = `short_${normalized}`;
          if (isKnownStrategy(shortCandidate, map) && apply(shortCandidate, 'ensure-short-prefix')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        if (/_exit$/.test(normalized)) {
          const base = normalized.replace(/_exit$/, '');
          const shortCandidate = normalized.startsWith('short_')
            ? `short_${base.replace(/^short_/, '')}`
            : `short_${base}`;
          if (isKnownStrategy(shortCandidate, map) && apply(shortCandidate, 'strip-exit-and-short')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        return { normalized, aliasApplied: normalized !== id, reason };
      }

      if (role === 'shortExit') {
        if (normalized.startsWith('short_')) {
          const base = normalized.replace(/^short_/, '');
          const coverCandidate = `cover_${base}`;
          if (isKnownStrategy(coverCandidate, map) && apply(coverCandidate, 'swap-short-to-cover')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        if (!normalized.startsWith('cover_')) {
          const coverCandidate = `cover_${normalized}`;
          if (isKnownStrategy(coverCandidate, map) && apply(coverCandidate, 'ensure-cover-prefix')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        if (!/_exit$/.test(normalized)) {
          const exitCandidate = `${normalized}_exit`;
          if (isKnownStrategy(exitCandidate, map) && apply(exitCandidate, 'append-exit-suffix')) {
            return { normalized, aliasApplied: true, reason };
          }
        }
        return { normalized, aliasApplied: normalized !== id, reason };
      }

      return { normalized, aliasApplied: normalized !== id, reason };
    }

    function ensureStrategyRoleId(id, role, descriptions) {
      return resolveRoleAlias(id, role, descriptions).normalized;
    }

    return {
      ensureStrategyRoleId,
      resolveRoleAlias,
    };
  },
);
