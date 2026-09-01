import axios from 'axios';

/**
 * Instância do Axios com credentials habilitado — o browser enviará
 * automaticamente o cookie HttpOnly "jwt" em todas as requisições para
 * o mesmo domínio/origem. Não há mais injeção manual de token no header.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

/**
 * Interceptor de resposta: em 401 ou 403 em rota admin redireciona para
 * o login. O cookie é limpo pelo backend via POST /auth/logout — aqui
 * só tratamos o redirecionamento de UI.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 ||
      (error.response?.status === 403 && error.config?.url?.includes('/admin/'))
    ) {
      // Limpa o user do localStorage (o cookie é gerenciado pelo backend)
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
