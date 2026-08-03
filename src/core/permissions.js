export const DEFAULT_ROUTES = {
  admin: '/admin/dashboard',
  super_admin: '/admin/dashboard',
  judge: '/juri/penilaian',
  operator: '/operator/monitor',
  viewer: '/hasil',
};

export function canAccess(role, allowedRoles) {
  return allowedRoles.length === 0 || allowedRoles.includes(role);
}

export function defaultRoute(role) {
  return DEFAULT_ROUTES[role] || '/login';
}
