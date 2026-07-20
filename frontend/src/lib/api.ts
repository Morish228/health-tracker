import axios, { type AxiosInstance } from 'axios';
// axios -> http client , axiosInstance -> type script type 
const TOKEN_KEY = 'hc_token';

// browser has a small db know as local storage 
// we store these tokens there 

export const getToken = () => localStorage.getItem(TOKEN_KEY); // basic fn to get a token 
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t); // basic fn to set a token
export const clearToken = () => localStorage.removeItem(TOKEN_KEY); // basic fn to clear a token 


function makeClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL });

  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error.response?.status === 401 && getToken()) {
        clearToken();
        // Hard redirect keeps auth state simple and predictable.
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
      return Promise.reject(error);
    },
  );

  return client;
}
//We create an Axios client with a base URL so we don't keep writing the full URL
// . Then we attach interceptors—one before sending every request (to add the JWT) and one after receiving every response (to handle things like 
// a 401 by clearing the token and redirecting to the login page).
// One client per service. The backend owns auth/vitals/appointments/etc.
export const backend = makeClient(import.meta.env.VITE_BACKEND_URL);
export const ragApi = makeClient(import.meta.env.VITE_RAG_URL);
export const agentApi = makeClient(import.meta.env.VITE_AGENT_URL);
export const scannerApi = makeClient(import.meta.env.VITE_SCANNER_URL);

/** Pull a human-readable message out of an axios error. */
export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    // Express services use `message`; FastAPI services (rag/agent/scanner) use `detail`.
    return data?.message || data?.detail || err.message || fallback;
  }
  return fallback;
}
