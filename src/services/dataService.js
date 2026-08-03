import { supabaseAdapter } from './supabaseAdapter.js';
import { getState } from '../core/state.js';
import { createQueryCache } from './queryCache.js';

const READ_METHODS = new Set(['previewResults']);

function isReadMethod(name) {
  return name.startsWith('get') || READ_METHODS.has(name);
}

function queryKey(scope, name, args) {
  return `${scope}:${name}:${JSON.stringify(args)}`;
}

export function createDataService(adapter, {
  getScope = () => getState().user?.id || 'anonim',
  ttlMs = 30_000,
} = {}) {
  const cache = createQueryCache({ ttlMs });
  const service = {};

  for (const [name, method] of Object.entries(adapter)) {
    if (name === 'subscribeOperational') {
      service[name] = (...args) => {
        const callback = args.at(-1);
        const wrappedArgs = typeof callback === 'function'
          ? [...args.slice(0, -1), (...callbackArgs) => { cache.clear(); callback(...callbackArgs); }]
          : args;
        return method(...wrappedArgs);
      };
    } else if (isReadMethod(name)) {
      service[name] = (...args) => cache.query(queryKey(getScope(), name, args), () => method(...args));
    } else {
      service[name] = async (...args) => {
        const result = await method(...args);
        cache.clear();
        return result;
      };
    }
  }

  service.clearQueryCache = () => cache.clear();
  return service;
}

export const dataService = createDataService(supabaseAdapter);

export function clearQueryCache() {
  dataService.clearQueryCache();
}
