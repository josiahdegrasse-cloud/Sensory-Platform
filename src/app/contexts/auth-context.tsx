import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { acceptPanelistConsent, CURRENT_CONSENT_VERSION } from '../lib/database';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'panelist';
  name: string;
  panelistId?: string;
  status?: 'active' | 'inactive' | 'archived';
  consentAcceptedAt?: string | null;
  consentVersion?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<string | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  acceptConsent: () => Promise<string | null>;
  isAuthenticated: boolean;
  isPasswordRecovery: boolean;
  loading: boolean;
  /** Why the last session was rejected (deactivated account, no workspace). Shown on the login page. */
  authNotice: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ProfileResult {
  profile: User | null;
  blockedMessage: string | null;
}

async function loadProfile(supabaseUser: SupabaseUser): Promise<ProfileResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', supabaseUser.id)
    .single();
  if (error || !data) return { profile: null, blockedMessage: null };
  if (data.status && data.status !== 'active') {
    return { profile: null, blockedMessage: 'This account has been deactivated. Contact your study administrator.' };
  }
  // org_id === null means the account isn't linked to any company workspace
  // (RLS would show it nothing anyway). undefined = pre-multi-tenancy DB; allow.
  if (data.org_id === null) {
    return {
      profile: null,
      blockedMessage: 'This account isn’t linked to a company workspace yet. Sign in with your company email address, or ask your administrator for an invite.',
    };
  }
  return {
    profile: {
      id: supabaseUser.id,
      email: supabaseUser.email ?? '',
      role: data.role as 'admin' | 'panelist',
      name: data.name ?? supabaseUser.email ?? '',
      panelistId: data.panelist_id ?? undefined,
      status: data.status ?? 'active',
      consentAcceptedAt: data.consent_accepted_at ?? null,
      consentVersion: data.consent_version ?? null,
    },
    blockedMessage: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionUser, setSessionUser] = useState<SupabaseUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
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
    loadProfile(sessionUser).then(({ profile, blockedMessage }) => {
      if (!profile) {
        setUser(null);
        if (blockedMessage) setAuthNotice(blockedMessage);
        void supabase.auth.signOut();
      } else {
        setUser(profile);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [sessionUser]);

  const login = async (email: string, password: string): Promise<string | null> => {
    setAuthNotice(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unknown error';
    }
  };

  const loginWithGoogle = async (): Promise<string | null> => {
    setAuthNotice(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: import.meta.env.VITE_APP_URL ?? window.location.origin,
        },
      });
      if (error) return error.message;
      return null; // browser is redirecting to Google
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

  const acceptConsent = async (): Promise<string | null> => {
    if (!user) return 'You must be signed in to accept consent.';
    try {
      const acceptedAt = await acceptPanelistConsent(user.id);
      setUser(prev => prev ? {
        ...prev,
        consentAcceptedAt: acceptedAt,
        consentVersion: CURRENT_CONSENT_VERSION,
      } : prev);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to save consent.';
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, logout, resetPassword, updatePassword, acceptConsent, isAuthenticated: !!user, isPasswordRecovery, loading, authNotice }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
