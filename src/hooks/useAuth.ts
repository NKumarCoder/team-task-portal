import { useAuthContext } from '../components/providers';
import type { Permissions } from '../utils/permissions';

export function useAuth() {
  return useAuthContext();
}

// Helper hook to check specific permission
export function usePermission(action: keyof Permissions) {
  const { hasPermission } = useAuthContext();
  return hasPermission(action);
}
