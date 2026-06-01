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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout — never hang on loading forever
    const timeout = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          const profile = await loadProfile(session.user);
          setUser(profile);
        } catch (err) {
          console.error('Failed to load profile:', err);
        }
      }
      clearTimeout(timeout);
      setLoading(false);
    }).catch(err => {
      console.error('getSession failed:', err);
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[onAuthStateChange] event:', event, 'user:', session?.user?.id ?? null);
        if (session?.user) {
          try {
            const profile = await loadProfile(session.user);
            console.log('[onAuthStateChange] profile loaded:', profile);
            setUser(profile);
          } catch (err) {
            console.error('Failed to load profile:', err);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out — check your connection and try again.')), ms)
          ),
        ]);

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000
      );
      if (error) return error.message;
      if (data.user) {
        const profile = await withTimeout(loadProfile(data.user), 8000);
        if (!profile) {
          await supabase.auth.signOut();
          return 'Account setup is incomplete. Ask your administrator to add your profile.';
        }
      }
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
