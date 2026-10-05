import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth";
import { onUnauthorized, tokenStore } from "../api/client";

const AuthContext = createContext(null);

// Where each role lands after login.
export const HOME_FOR_ROLE = { tenant: "/tenant", owner: "/owner", admin: "/admin" };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "checking" while we validate a stored token on first load, so protected
  // pages don't flash the login screen for an already-logged-in user.
  const [status, setStatus] = useState(() => (tokenStore.get() ? "checking" : "anonymous"));
  const [notice, setNotice] = useState(null);

  const logout = useCallback((message) => {
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
    setNotice(typeof message === "string" ? message : null);
  }, []);

  useEffect(() => {
    onUnauthorized((message) => logout(message || "Your session has ended. Please log in again."));
  }, [logout]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    const ctrl = new AbortController();
    authApi
      .me({ signal: ctrl.signal })
      .then(({ user: u }) => {
        setUser(u);
        setStatus("authenticated");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        // Network failure: keep the token, but let the user retry by reloading.
        if (err.status === 0) setStatus("offline");
        else logout();
      });
    return () => ctrl.abort();
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await authApi.login(email, password);
    tokenStore.set(token);
    setUser(u);
    setStatus("authenticated");
    setNotice(null);
    return u;
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, notice, clearNotice: () => setNotice(null) }),
    [user, status, login, logout, notice]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
