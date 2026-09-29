import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';

export interface User {
  id: string;
  sourceId: string | null;
  email: string;
  displayName: string;
  globalRole: string;
  eventRoles?: Record<string, string>;
  bio?: string | null;
  emailVerified?: boolean;
  avatarUrl?: string | null;
}

export type DemoPersona = 'ORGANIZER' | 'JUDGE_A' | 'JUDGE_B' | 'PARTICIPANT' | 'VISITOR';

export interface AppConfig {
  appMode: 'demo' | 'selfhosted' | 'cloud';
  demoEnabled: boolean;
  version: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activePersona: DemoPersona | null;
  appConfig: AppConfig;
  isOrganizer: boolean;
  isJudge: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ user: User; token: string }>;
  register: (email: string, password: string, displayName: string) => Promise<{ user: User; token: string; verificationToken?: string }>;
  switchPersona: (persona: DemoPersona) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Deterministic test tokens matching seed (used only when demoEnabled is true)
const PERSONA_TOKENS: Record<DemoPersona, string | null> = {
  ORGANIZER: 'dogfood_org_session_token_2026',
  JUDGE_A: 'dogfood_judge_a_session_token_2026',
  JUDGE_B: 'dogfood_judge_b_session_token_2026',
  PARTICIPANT: 'dogfood_participant_session_token_2026',
  VISITOR: null,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePersona, setActivePersona] = useState<DemoPersona | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>({
    appMode: 'selfhosted',
    demoEnabled: false,
    version: '1.0.0',
  });

  const refreshConfig = async () => {
    try {
      const cfg = await apiRequest<AppConfig>('/public/config');
      setAppConfig(cfg);
      if (!cfg.demoEnabled) {
        setActivePersona(null);
      }
      return cfg;
    } catch {
      return appConfig;
    }
  };

  const refreshUser = async () => {
    try {
      const data = await apiRequest<{ user: User | null }>('/auth/me');
      setUser(data.user);
      if (appConfig.demoEnabled) {
        if (data.user) {
          if (data.user.email === 'organizer@dogfood.local') setActivePersona('ORGANIZER');
          else if (data.user.sourceId === 'jdg_01') setActivePersona('JUDGE_A');
          else if (data.user.sourceId === 'jdg_02') setActivePersona('JUDGE_B');
          else if (data.user.email === 'lucas.silva@example.org') setActivePersona('PARTICIPANT');
        } else {
          setActivePersona('VISITOR');
        }
      } else {
        setActivePersona(null);
      }
    } catch {
      setUser(null);
      setActivePersona(appConfig.demoEnabled ? 'VISITOR' : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const cfg = await refreshConfig();
      if (cfg.demoEnabled) {
        setActivePersona('VISITOR');
      }
      await refreshUser();
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token && typeof window !== 'undefined') {
      localStorage.setItem('dogfood_session_token', res.token);
      document.cookie = `session=${res.token}; Path=/; max-age=2592000; SameSite=Lax`;
    }
    await refreshUser();
    return res;
  };

  const register = async (email: string, password: string, displayName: string) => {
    const res = await apiRequest<{ user: User; token: string; verificationToken?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    if (res.token && typeof window !== 'undefined') {
      localStorage.setItem('dogfood_session_token', res.token);
      document.cookie = `session=${res.token}; Path=/; max-age=2592000; SameSite=Lax`;
    }
    await refreshUser();
    return res;
  };

  const switchPersona = async (persona: DemoPersona) => {
    if (!appConfig.demoEnabled) {
      console.warn('Persona switching is disabled in production mode.');
      return;
    }
    setLoading(true);
    try {
      if (persona === 'VISITOR') {
        document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        if (typeof window !== 'undefined') {
          localStorage.removeItem('dogfood_session_token');
        }
        try {
          await apiRequest('/auth/logout', { method: 'POST' });
        } catch {}
      } else {
        const token = PERSONA_TOKENS[persona];
        if (token) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('dogfood_session_token', token);
          }
          document.cookie = `session=${token}; Path=/; max-age=86400; SameSite=Lax`;
        }
      }
      await refreshUser();
    } catch (err) {
      console.error('Failed to switch persona:', err);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dogfood_session_token');
      document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
    setUser(null);
    if (appConfig.demoEnabled) {
      setActivePersona('VISITOR');
    } else {
      setActivePersona(null);
    }
    setLoading(false);
  };

  const isOrganizer =
    user?.globalRole === 'ADMIN' ||
    activePersona === 'ORGANIZER' ||
    !!(user?.eventRoles && Object.values(user.eventRoles).some((r) => r === 'ORGANIZER'));

  const isJudge =
    user?.globalRole === 'ADMIN' ||
    user?.globalRole === 'JUDGE' ||
    activePersona === 'JUDGE_A' ||
    activePersona === 'JUDGE_B' ||
    !!(user?.eventRoles && Object.values(user.eventRoles).some((r) => r === 'JUDGE'));

  const isAdmin = user?.globalRole === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activePersona,
        appConfig,
        isOrganizer,
        isJudge,
        isAdmin,
        login,
        register,
        switchPersona,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
