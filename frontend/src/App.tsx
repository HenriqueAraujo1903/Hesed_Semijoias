import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import AdminProductsPage from './pages/AdminProductsPage';
import AdminPromotionsPage from './pages/AdminPromotionsPage';
import ConsigneesPage from './pages/ConsigneesPage';
import CatalogoPage from './pages/CatalogoPage';

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/catalogo" element={<CatalogoPage />} />

      {/* Protected */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/produtos" element={<ProductsPage />} />
        <Route path="/revendedoras" element={<ConsigneesPage />} />
        <Route path="/admin/produtos" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><AdminProductsPage /></ProtectedRoute>
        } />
        <Route path="/admin/promocoes" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><AdminPromotionsPage /></ProtectedRoute>
        } />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
