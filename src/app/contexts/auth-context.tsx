import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'panelist';
  name: string;
  panelistId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  isAuthenticated: boolean;
  isPasswordRecovery: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadProfile(supabaseUser: SupabaseUser): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', supabaseUser.id)
    .single();
  if (error || !data) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    role: data.role as 'admin' | 'panelist',
    name: data.name ?? supabaseUser.email ?? '',
    panelistId: data.panelist_id ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionUser, setSessionUser] = useState<SupabaseUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const isPasswordRecoveryRef = useRef(false);

  // Step 1: listen for auth changes — sync only, no async db calls inside handler
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user ?? null);
    }).catch(() => {
      setSessionUser(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSessionUser(session?.user ?? null);
      if (!session?.user) setUser(null);
      if (event === 'TOKEN_REFRESHED' && !session) supabase.auth.signOut();
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        isPasswordRecoveryRef.current = true;
      }
      if (event === 'SIGNED_IN' && isPasswordRecoveryRef.current) {
        setIsPasswordRecovery(false);
        isPasswordRecoveryRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Step 2: load profile once we know the session user
  useEffect(() => {
    if (sessionUser === undefined) return; // still waiting for getSession
    if (!sessionUser) {
      setLoading(false);
      return;
    }
    loadProfile(sessionUser).then(profile => {
      setUser(profile);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [sessionUser]);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unknown error';
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updatePassword = async (newPassword: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return error.message;
      setIsPasswordRecovery(false);
      await supabase.auth.signOut();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unknown error';
    }
  };

  const resetPassword = async (email: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/reset-password`,
      });
      if (error) return error.message;
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unknown error';
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, resetPassword, updatePassword, isAuthenticated: !!user, isPasswordRecovery, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
