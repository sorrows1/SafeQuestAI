import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store';
import { setUser, logout } from '@/store/authSlice';
import { useGetMeQuery } from '@/store/api';

/** Requires any authenticated user. Redirects to /login if not. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppSelector(s => s.auth);
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <AuthInitializer>{children}</AuthInitializer>;
}

/** Requires admin role. Redirects to /family/scenarios if logged in but not admin. */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAppSelector(s => s.auth);
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user && user.role !== 'admin') return <Navigate to="/family/scenarios" replace />;
  return <AuthInitializer requireAdmin>{children}</AuthInitializer>;
}

/** Loads /auth/me on mount to populate the user object from the stored token. */
function AuthInitializer({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(s => s.auth);
  const { data, isLoading, isError } = useGetMeQuery(undefined, { skip: !!user });

  useEffect(() => {
    if (data) dispatch(setUser(data as any));
  }, [data, dispatch]);

  useEffect(() => {
    if (isError) dispatch(logout());
  }, [isError, dispatch]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (requireAdmin && user && user.role !== 'admin') {
    return <Navigate to="/family/scenarios" replace />;
  }

  return <>{children}</>;
}
