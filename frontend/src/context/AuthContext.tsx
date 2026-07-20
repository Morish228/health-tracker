import {
  createContext, // create a context [global] 
  useContext,  // read from the conteext 
  useEffect,  // runs after every page refresh 
  useState,  // store the state 
  type ReactNode, // represent what ever component are inside the context 
} from 'react';
import { backend, setToken, clearToken, getToken } from '../lib/api';
import type { User } from '../types';

interface AuthState {  // defines what the context will  contain 
  user: User | null; // user detaiils -> id , email , role
  loading: boolean; // whether authentication is still being checked
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  registerDoctor: (data: DoctorRegisterInput) => Promise<void>;
  logout: () => void;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface DoctorRegisterInput {
  email: string;
  password: string;
  name: string;
  specialization: string;
  qualifications?: string;
  contact?: string;
}

const AuthContext = createContext<AuthState | undefined>(undefined);   // initialy empty context ,later authstate.provider fills it 


function normalizeUser(u: any, profile?: any): User {
  const p = profile ?? u?.profile;
  return {
    id: u?.id ?? u?._id,
    email: u?.email,
    role: u?.role,
    firstName: p?.firstName,
    lastName: p?.lastName,
  };
}  // just a helper fn as backend send 2 different response format so it convert both into single 

export function AuthProvider({ children }: { children: ReactNode }) {   
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on first load if a token is present.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    backend
      .get('/api/auth/me')
      .then((res) => {
        const d = res.data.data;
        setUser(d?.user ? normalizeUser(d.user, d.profile) : null);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await backend.post('/api/auth/login', { email, password });
    const { token, user: u } = res.data.data;
    setToken(token);
    setUser(normalizeUser(u));
  }

  async function register(data: RegisterInput) {
    await backend.post('/api/auth/register', data);
    // Backend register does not return a token — log in immediately after.
    await login(data.email, data.password);
  }

  async function registerDoctor(data: DoctorRegisterInput) {
    await backend.post('/api/doctor-portal/register', data);
    // Doctor register also returns no token — log in to obtain one.
    await login(data.email, data.password);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, registerDoctor, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
