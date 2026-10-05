import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { signup } from "../../api/auth";
import { HOME_FOR_ROLE, useAuth } from "../../auth/AuthContext";
import { Button, Field, InlineError } from "../../components/ui";

export default function Signup() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get("role") === "owner" ? "owner" : "tenant");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ownerDone, setOwnerDone] = useState(false);

  if (user) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        ...(form.phone.trim() ? { phone: form.phone.replace(/\s|-/g, "") } : {}),
      };
      await signup(body);
      if (role === "tenant") {
        await login(body.email, body.password);
        navigate("/search", { replace: true });
      } else {
        setOwnerDone(true);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (ownerDone) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Thanks, {form.name.split(" ")[0]}.</h1>
          <p>
            Your owner account is waiting for approval. Our team checks new owners within one working day. Once
            approved, log in with <strong>{form.email}</strong> to add your PG.
          </p>
          <Link to="/login" state={{ email: form.email }} className="btn btn-primary btn-block">
            Go to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Create your account</h1>
        <fieldset className="role-switch">
          <legend>I am</legend>
          <label className={role === "tenant" ? "on" : ""}>
            <input type="radio" name="role" value="tenant" checked={role === "tenant"} onChange={() => setRole("tenant")} />
            <strong>Looking for a room</strong>
            <span>Find a PG and pay rent online</span>
          </label>
          <label className={role === "owner" ? "on" : ""}>
            <input type="radio" name="role" value="owner" checked={role === "owner"} onChange={() => setRole("owner")} />
            <strong>A PG owner</strong>
            <span>List rooms and manage tenants</span>
          </label>
        </fieldset>

        <Field label="Full name">
          {(p) => <input autoComplete="name" required value={form.name} onChange={set("name")} {...p} />}
        </Field>
        <Field label="Email">
          {(p) => (
            <input type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={set("email")} {...p} />
          )}
        </Field>
        <Field label="Mobile number" hint={role === "owner" ? "Tenants and our team will use this to reach you." : "Optional. Owners see it when you request a room."}>
          {(p) => (
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={form.phone}
              onChange={set("phone")}
              {...p}
            />
          )}
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          {(p) => (
            <input type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set("password")} {...p} />
          )}
        </Field>
        <InlineError error={error} />
        <Button type="submit" size="lg" loading={busy} className="btn-block">
          {role === "owner" ? "Create owner account" : "Create account"}
        </Button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
