import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  /**
   * O user é inicializado do localStorage para evitar flicker na primeira
   * renderização. O useEffect abaixo valida imediatamente com o servidor
   * (via cookie) e corrige o estado se a sessão tiver expirado.
   *
   * O token NÃO é mais armazenado no frontend — ele vive apenas no
   * cookie HttpOnly gerenciado pelo browser.
   */
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // `loading` cobre o intervalo da verificação inicial de sessão (/auth/me).
  // Enquanto true, as rotas protegidas aguardam em vez de redirecionar,
  // evitando flash de tela / piscar.
  const [loading, setLoading] = useState(true);

  // Persiste o user (dados não-sensíveis) no localStorage para inicialização
  // rápida. O token sensível nunca chega aqui.
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  /**
   * Valida a sessão com o servidor na montagem do Provider. Se o cookie for
   * inválido ou expirado, limpa o user do estado (forçando redirecionamento
   * para o login pelo ProtectedRoute). O interceptor da API ignora o 401 de
   * /auth/me, então essa verificação não dispara redirecionamento em loop.
   */
  useEffect(() => {
    api.get('/auth/me')
      .then((res) => {
        const d = res.data;
        setUser({ id: d.id, name: d.name, email: d.email, role: d.role });
      })
      .catch(() => {
        // Cookie ausente, expirado ou inválido — garante estado limpo
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // roda uma vez na montagem

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    const d = res.data;
    // O token está no cookie HttpOnly; aqui só salvamos os dados de exibição
    setUser({ id: d.id, name: d.name, email: d.email, role: d.role });
  }

  async function logout() {
    try {
      // O backend limpa o cookie via Set-Cookie com maxAge=0
      await api.post('/auth/logout');
    } catch {
      // Segue mesmo se a chamada falhar — o estado local será limpo de qualquer forma
    } finally {
      setUser(null);
    }
  }

  const isAdmin = user?.role === 'ROLE_ADMIN';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
