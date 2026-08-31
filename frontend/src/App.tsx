import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DashboardsPage from './pages/DashboardsPage';
import SalesDashboardPage from './pages/dashboards/SalesDashboardPage';
import EngagementDashboardPage from './pages/dashboards/EngagementDashboardPage';
import OrdersPage from './pages/OrdersPage';
import AdminPromotionsPage from './pages/AdminPromotionsPage';
import ConsigneesPage from './pages/ConsigneesPage';
import SuppliersPage from './pages/SuppliersPage';
import StockPage from './pages/StockPage';
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
        <Route path="/dashboards" element={<DashboardsPage />} />
        <Route path="/dashboards/vendas" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><SalesDashboardPage /></ProtectedRoute>
        } />
        <Route path="/dashboards/engajamento" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><EngagementDashboardPage /></ProtectedRoute>
        } />
        <Route path="/pedidos" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><OrdersPage /></ProtectedRoute>
        } />
        <Route path="/revendedoras" element={<ConsigneesPage />} />
        {/* Rotas antigas de produtos consolidadas na aba Estoque */}
        <Route path="/produtos" element={<Navigate to="/admin/estoque" replace />} />
        <Route path="/admin/produtos" element={<Navigate to="/admin/estoque" replace />} />
        <Route path="/admin/promocoes" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><AdminPromotionsPage /></ProtectedRoute>
        } />
        <Route path="/admin/fornecedores" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><SuppliersPage /></ProtectedRoute>
        } />
        <Route path="/admin/estoque" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><StockPage /></ProtectedRoute>
        } />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
