import { getState } from './state.js';
import { canAccess, defaultRoute } from './permissions.js';

let routes = [];
let renderRoute = () => {};

export function compilePath(path) {
  if (path === '*') return { regex: /^.*$/, keys: [] };
  const keys = [];
  const pattern = path.replace(/:([^/]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), keys };
}

export function configureRouter(routeList, renderer) {
  routes = routeList.map((route) => ({ ...route, ...compilePath(route.path) }));
  renderRoute = renderer;
  window.addEventListener('popstate', resolveRoute);
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (!link || event.metaKey || event.ctrlKey || link.target === '_blank') return;
    event.preventDefault();
    navigate(link.getAttribute('href'));
  });
}

export function navigate(path, { replace = false } = {}) {
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  resolveRoute();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export async function resolveRoute() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const matched = routes.find((route) => route.regex.test(path));
  const user = getState().user;

  if (!matched) {
    const notFound = routes.find((route) => route.path === '*');
    return renderRoute(notFound, {});
  }
  if (matched.auth && !user) return navigate('/login', { replace: true });
  if (path === '/login' && user) return navigate(defaultRoute(user.role), { replace: true });
  if (matched.roles && !canAccess(user?.role, matched.roles)) {
    return renderRoute(routes.find((route) => route.path === '/unauthorized'), {});
  }

  const values = path.match(matched.regex)?.slice(1) || [];
  const params = Object.fromEntries(matched.keys.map((key, index) => [key, decodeURIComponent(values[index])]));
  return renderRoute(matched, params);
}
