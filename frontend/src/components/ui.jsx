import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

export function Button({ variant = "primary", size, loading, children, className = "", ...props }) {
  return (
    <button
      className={`btn btn-${variant}${size ? ` btn-${size}` : ""} ${className}`}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

export function Field({ label, hint, error, children, id: givenId }) {
  const autoId = useId();
  const id = givenId || autoId;
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field${error ? " field-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {typeof children === "function"
        ? children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
        : children}
      {hint && !error && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

const STATUS_TEXT = {
  vacant: "Vacant",
  partial: "Partly filled",
  occupied: "Full",
  pending: "Waiting",
  approved: "Live",
  confirmed: "Confirmed",
  rejected: "Declined",
  cancelled: "Cancelled",
  paid: "Paid",
  unpaid: "Due",
  overdue: "Overdue",
  suspended: "Suspended",
};

export function StatusChip({ status, children }) {
  return <span className={`chip chip-${status}`}>{children || STATUS_TEXT[status] || status}</span>;
}

export function Spinner({ label = "Loading" }) {
  return <span className="spinner spinner-lg" role="status" aria-label={label} />;
}

export function FullPageLoader() {
  return (
    <div className="center-screen">
      <Spinner />
    </div>
  );
}

// Skeleton rows for list screens - keeps layout stable while loading.
export function LoadingList({ rows = 3, label = "Loading" }) {
  return (
    <div className="skeleton-list" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <span className="sk sk-title" />
          <span className="sk sk-line" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="state state-empty">
      <svg className="state-icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 22 24 9l16 13v17H8z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M19 39V28h10v11" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "This didn't load", message, error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <h3>{title}</h3>
      <p>{message || error?.message || "Something went wrong."}</p>
      {error?.requestId && <p className="muted small">Reference: {error.requestId}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={() => onRetry()}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ error }) {
  if (!error) return null;
  return (
    <div className="inline-error" role="alert">
      {typeof error === "string" ? error : error.message}
    </div>
  );
}

// Renders loading / error / empty / content for a useAsync() result.
export function AsyncBlock({ state, isEmpty, empty, loadingRows = 3, children }) {
  const { data, error, loading, reload } = state;
  if (loading && !data) return <LoadingList rows={loadingRows} />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (data && isEmpty && isEmpty(data)) return empty;
  if (!data) return null;
  return children(data);
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

// ---------- Modal ----------
export function Modal({ open, title, onClose, children, footer, size }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal${size ? ` modal-${size}` : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      {open && (
        <div className="modal-inner">
          <div className="modal-head">
            <h2 id="modal-title">{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// ---------- Toasts ----------
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
