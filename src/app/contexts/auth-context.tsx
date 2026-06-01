import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadProfile(supabaseUser: SupabaseUser): Promise<User | null> {
  console.log('[loadProfile] fetching for id:', supabaseUser.id);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', supabaseUser.id)
    .single();
  console.log('[loadProfile] result — data:', data, 'error:', error?.message, error?.code);
  if (error) {
    console.error('loadProfile error:', error.message, error.code);
  }
  if (!data) return null;
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

  // Step 1: listen for auth changes — sync only, no async db calls inside handler
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user ?? null);
    }).catch(() => {
      setSessionUser(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionUser(session?.user ?? null);
      if (!session?.user) setUser(null);
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

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
