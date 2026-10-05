import { useCallback, useEffect, useRef, useState } from "react";

// Loads data for a screen and exposes { data, error, loading, reload, setData }.
// `fn` receives an AbortSignal; requests are cancelled when deps change or the
// component unmounts, so a slow old response never overwrites a newer one.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const ctrlRef = useRef(null);

  const run = useCallback(({ silent = false } = {}) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    return fnRef.current(ctrl.signal).then(
      (data) => {
        if (!ctrl.signal.aborted) setState({ data, error: null, loading: false });
        return data;
      },
      (error) => {
        if (error.name === "AbortError" || ctrl.signal.aborted) return;
        setState((s) => ({ ...s, error, loading: false }));
      }
    );
  }, []);

  useEffect(() => {
    run();
    return () => ctrlRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
