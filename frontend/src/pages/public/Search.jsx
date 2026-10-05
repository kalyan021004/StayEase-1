import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchPgs } from "../../api/pgs";
import { CITIES } from "../../lib/format";
import PgListItem from "../../components/PgListItem";
import { Button, EmptyState, ErrorState, LoadingList } from "../../components/ui";

const PAGE_SIZE = 12;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const filters = {
    city: params.get("city") || "",
    genderType: params.get("genderType") || "",
    minRent: params.get("minRent") || "",
    maxRent: params.get("maxRent") || "",
  };
  const key = JSON.stringify(filters);

  const [pgs, setPgs] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  // Reset when filters change.
  useEffect(() => {
    setPgs([]);
    setPage(1);
  }, [key]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    searchPgs({ ...JSON.parse(key), page, limit: PAGE_SIZE }, { signal: ctrl.signal })
      .then((d) => {
        setPgs((prev) => (page === 1 ? d.pgs : [...prev, ...d.pgs]));
        setHasMore(d.hasMore);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [key, page, retry]);

  function update(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }

  const title = filters.city ? `PGs in ${filters.city}` : "PGs in all cities";

  return (
    <div className="page page-wide">
      <div className="search-layout">
        <aside className="filters" aria-label="Filters">
          <h1 className="filters-title">{title}</h1>
          <div className="filter-group">
            <span className="filter-label" id="f-city">City</span>
            <div className="chips" role="group" aria-labelledby="f-city">
              <button className={`chip-btn${!filters.city ? " on" : ""}`} onClick={() => update("city", "")}>
                All
              </button>
              {CITIES.map((c) => (
                <button
                  key={c}
                  className={`chip-btn${filters.city === c ? " on" : ""}`}
                  aria-pressed={filters.city === c}
                  onClick={() => update("city", c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-label" id="f-for">PG for</span>
            <div className="chips" role="group" aria-labelledby="f-for">
              {[
                ["", "Anyone"],
                ["male", "Men"],
                ["female", "Women"],
                ["unisex", "Co-living"],
              ].map(([v, l]) => (
                <button
                  key={v || "any"}
                  className={`chip-btn${filters.genderType === v ? " on" : ""}`}
                  aria-pressed={filters.genderType === v}
                  onClick={() => update("genderType", v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group rent-range">
            <span className="filter-label">Monthly rent (₹)</span>
            <div className="range-inputs" key={`${filters.minRent}|${filters.maxRent}`}>
              <label>
                <span className="sr-only">Minimum rent</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="500"
                  placeholder="Min"
                  defaultValue={filters.minRent}
                  onBlur={(e) => update("minRent", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </label>
              <span aria-hidden="true">to</span>
              <label>
                <span className="sr-only">Maximum rent</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="500"
                  placeholder="Max"
                  defaultValue={filters.maxRent}
                  onBlur={(e) => update("maxRent", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              </label>
            </div>
          </div>
        </aside>

        <section className="results" aria-live="polite">
          {error && pgs.length === 0 ? (
            <ErrorState error={error} onRetry={() => setRetry((n) => n + 1)} />
          ) : loading && pgs.length === 0 ? (
            <LoadingList rows={4} label="Finding PGs" />
          ) : pgs.length === 0 ? (
            <EmptyState
              title="No PGs match these filters"
              message="Try a higher budget or a different city."
              action={
                <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="pg-list">
                {pgs.map((pg) => (
                  <PgListItem key={pg.id} pg={pg} />
                ))}
              </div>
              {error && <ErrorState error={error} onRetry={() => setRetry((n) => n + 1)} />}
              {hasMore && !error && (
                <div className="more">
                  <Button variant="secondary" loading={loading} onClick={() => setPage((p) => p + 1)}>
                    Show more PGs
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
