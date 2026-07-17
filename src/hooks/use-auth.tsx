import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);

      // O link de e-mail de recuperação de senha (`resetPasswordForEmail`)
      // depende da URL de redirect estar na allowlist do Supabase (Auth →
      // URL Configuration → Redirect URLs). Mesmo com o wildcard
      // `https://outlife-app.vercel.app/**` cadastrado, o Supabase pode
      // não casar o path exato solicitado (`/redefinir-senha`) e cair de
      // volta na Site URL pura (raiz `/`) — nesse caso o evento
      // PASSWORD_RECOVERY ainda dispara normalmente (a sessão de
      // recuperação é estabelecida), só a página é que fica errada. Este
      // listener global garante que, de qualquer página em que o usuário
      // aterrissar com esse evento, ele seja levado para a tela correta de
      // redefinição de senha.
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined" && window.location.pathname !== "/redefinir-senha") {
        router.navigate({ to: "/redefinir-senha" });
      }
    });
    // Then check existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
