import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DashboardsPage from './pages/DashboardsPage';
import SalesDashboardPage from './pages/dashboards/SalesDashboardPage';
import EngagementDashboardPage from './pages/dashboards/EngagementDashboardPage';
import StockDashboardPage from './pages/dashboards/StockDashboardPage';
import PromotionsDashboardPage from './pages/dashboards/PromotionsDashboardPage';
import OrdersPage from './pages/OrdersPage';
import AdminPromotionsPage from './pages/AdminPromotionsPage';
import ConsigneesPage from './pages/ConsigneesPage';
import SuppliersPage from './pages/SuppliersPage';
import CadastrosPage from './pages/CadastrosPage';
import StockPage from './pages/StockPage';
import SettingsPage from './pages/SettingsPage';
import CatalogoPage from './pages/CatalogoPage';

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  // Enquanto a sessão inicial não foi verificada, evita decidir o redirect
  // da rota /login (senão pisca entre login e dashboard).
  const loginElement = loading ? (
    <div className="flex min-h-screen items-center justify-center bg-cream dark:bg-charcoal-900">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
    </div>
  ) : isAuthenticated ? (
    <Navigate to="/dashboard" />
  ) : (
    <LoginPage />
  );

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={loginElement} />
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
        <Route path="/dashboards/estoque" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><StockDashboardPage /></ProtectedRoute>
        } />
        <Route path="/dashboards/promocoes" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><PromotionsDashboardPage /></ProtectedRoute>
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
        <Route path="/admin/cadastros" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><CadastrosPage /></ProtectedRoute>
        } />
        {/* Fornecedores foi consolidado na aba Cadastros */}
        <Route path="/admin/fornecedores" element={<Navigate to="/admin/cadastros" replace />} />
        <Route path="/admin/estoque" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><StockPage /></ProtectedRoute>
        } />
        <Route path="/admin/configuracoes" element={
          <ProtectedRoute requiredRole="ROLE_ADMIN"><SettingsPage /></ProtectedRoute>
        } />
        {/* Rota antiga de usuários consolidada em Configurações */}
        <Route path="/admin/usuarios" element={<Navigate to="/admin/configuracoes" replace />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
