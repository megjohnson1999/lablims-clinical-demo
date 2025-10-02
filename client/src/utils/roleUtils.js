/**
 * Role utility functions for frontend permission checks
 */

/**
 * Check if user can edit lab data (specimens, protocols, inventory, etc.)
 */
export const canEditLabData = (user) => {
  if (!user?.role) return false;
  return ['admin', 'lab_manager', 'lab_technician'].includes(user.role);
};

/**
 * Check if user can manage users and system settings
 */
export const canManageUsers = (user) => {
  if (!user?.role) return false;
  return ['admin', 'lab_manager'].includes(user.role);
};

/**
 * Check if user has admin privileges
 */
export const isAdmin = (user) => {
  return user?.role === 'admin';
};

/**
 * Check if user can view audit logs
 */
export const canViewAudit = (user) => {
  if (!user?.role) return false;
  return ['admin', 'lab_manager'].includes(user.role);
};

/**
 * Check if user can perform data imports
 */
export const canImportData = (user) => {
  if (!user?.role) return false;
  return ['admin', 'lab_manager', 'lab_technician'].includes(user.role);
};