import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAuthenticated, user, loading } = useAuth();

  // Enquanto a verificação inicial de sessão (/auth/me) não terminou, aguarda
  // em vez de redirecionar — evita flash/piscar entre dashboard e login.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream dark:bg-charcoal-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
