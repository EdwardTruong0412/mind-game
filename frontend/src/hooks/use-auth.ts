/**
 * useAuth Hook
 * Convenient hook to access auth context
 */

import { useAuthContext } from '@/contexts/auth-context';

export function useAuth() {
  return useAuthContext();
}
