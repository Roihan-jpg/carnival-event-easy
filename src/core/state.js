const listeners = new Set();

const state = {
  user: null,
  authReady: false,
  sessionMessage: '',
  activeEvent: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  sidebarCollapsed: false,
  mobileMenuOpen: false,
};

export function getState() {
  return { ...state };
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(getState()));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setState({ online: true }));
  window.addEventListener('offline', () => setState({ online: false }));
}
