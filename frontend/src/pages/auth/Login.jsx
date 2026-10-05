import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { HOME_FOR_ROLE, useAuth } from "../../auth/AuthContext";
import { Button, Field, InlineError } from "../../components/ui";

export default function Login() {
  const { login, user, notice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email.trim(), password);
      const from = location.state?.from;
      // Only return tenants to public pages they came from (e.g. a PG they wanted to book).
      navigate(from && (u.role === "tenant" || from.startsWith(HOME_FOR_ROLE[u.role])) ? from : HOME_FOR_ROLE[u.role], {
        replace: true,
      });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const info = location.state?.reason || location.state?.message || notice;

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Log in</h1>
        {info && (
          <div className="banner banner-info" role="status">
            {info}
            {notice && (
              <button type="button" className="icon-btn" onClick={clearNotice} aria-label="Dismiss">
                ×
              </button>
            )}
          </div>
        )}
        <Field label="Email">
          {(p) => (
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <Field label="Password">
          {(p) => (
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <InlineError error={error} />
        <Button type="submit" size="lg" loading={busy} className="btn-block">
          Log in
        </Button>
        <p className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
