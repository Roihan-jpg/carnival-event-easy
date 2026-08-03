import { navigate } from '../core/router.js';
import { setState } from '../core/state.js';
import { dataService } from './dataService.js';

export function bindLiveRefresh({ eventId, tables, pollMs = 30_000 }) {
  let refreshTimer;
  let disposed = false;
  const refresh = () => {
    if (disposed || document.visibilityState === 'hidden' || document.querySelector('dialog[open]')) return;
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      if (!disposed) {
        if (tables.includes('events')) setState({ activeEvent: null });
        navigate(`${window.location.pathname}${window.location.search}`, { replace: true });
      }
    }, 350);
  };
  const unsubscribers = [];
  for (const table of tables) {
    try {
      unsubscribers.push(dataService.subscribeOperational(table, eventId, refresh));
    } catch {
      // Polling below remains the operational fallback when Realtime is unavailable.
    }
  }
  const poller = window.setInterval(refresh, pollMs);
  return () => {
    disposed = true;
    window.clearTimeout(refreshTimer);
    window.clearInterval(poller);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
