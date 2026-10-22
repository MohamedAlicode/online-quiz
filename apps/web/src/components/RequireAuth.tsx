import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';
import type { UserDto } from '@quiz/shared';

/** Protège les routes de l'hôte et vérifie que le jeton est toujours valide. */
export function RequireAuth() {
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const location = useLocation();

  useEffect(() => {
    if (!token) return;
    // Un 401 déconnecte automatiquement (voir lib/api.ts).
    api<{ user: UserDto }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => undefined);
  }, [token, setUser]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
