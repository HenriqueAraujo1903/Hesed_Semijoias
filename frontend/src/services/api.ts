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
 * Interceptor de resposta: redireciona para o login quando uma sessão
 * expira durante o uso (401, ou 403 em rota admin).
 *
 * Exceções importantes (evitam loop de redirecionamento / tela piscando):
 *  - /auth/me e /auth/login: são verificações/tentativas de sessão. Um 401
 *    aqui é esperado quando não há sessão — quem trata é o AuthContext.
 *  - Já estar em /login: não redireciona de novo (senão recarrega em loop).
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || '';
    const status = error.response?.status;
    const isAuthProbe = url.includes('/auth/me') || url.includes('/auth/login');
    const alreadyOnLogin = window.location.pathname === '/login';

    const shouldRedirect =
      !isAuthProbe &&
      !alreadyOnLogin &&
      (status === 401 || (status === 403 && url.includes('/admin/')));

    if (shouldRedirect) {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
