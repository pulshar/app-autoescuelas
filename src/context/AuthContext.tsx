import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '../types.ts';
import { api, getStoredToken, setStoredToken } from '../lib/api.ts';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  loginWithGoogle: (email?: string, name?: string, googleId?: string, avatarUrl?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { name: string; phone?: string; avatar_url?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const currentToken = getStoredToken();
      if (!currentToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await api.getMe();
      setUser(data.user);
    } catch {
      // Token expired or invalid
      setStoredToken(null);
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    setStoredToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string, phone?: string) => {
    const data = await api.register({ email, password, name, phone });
    setStoredToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  };

  const loginWithGoogle = async (customEmail?: string, customName?: string, customGoogleId?: string, customAvatarUrl?: string) => {
    if (customEmail && customName) {
      const data = await api.googleLogin({ email: customEmail, name: customName, googleId: customGoogleId, avatarUrl: customAvatarUrl });
      setStoredToken(data.token);
      setTokenState(data.token);
      setUser(data.user);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const fbUser = result.user;
      const data = await api.googleLogin({
        email: fbUser.email || '',
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario Google',
        googleId: fbUser.uid,
        avatarUrl: fbUser.photoURL || undefined,
      });
      setStoredToken(data.token);
      setTokenState(data.token);
      setUser(data.user);
    } catch (err: any) {
      console.error('Firebase Google popup sign in error:', err);
      throw new Error(err.message || 'Error al iniciar sesión con Google.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch { }
    setStoredToken(null);
    setTokenState(null);
    setUser(null);
  };

  const updateProfile = async (data: { name: string; phone?: string; avatar_url?: string }) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        loading,
        login,
        register,
        loginWithGoogle,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
