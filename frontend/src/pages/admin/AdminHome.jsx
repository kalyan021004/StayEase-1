import { useState } from "react";
import { Link } from "react-router-dom";
import { platformOverview } from "../../api/auth";
import { generateBills } from "../../api/bills";
import { useAsync } from "../../hooks/useAsync";
import { currentMonth, monthLabel, rupees } from "../../lib/format";
import { AsyncBlock, Button, InlineError, PageHeader, useToast } from "../../components/ui";

export default function AdminHome() {
  const state = useAsync((signal) => platformOverview({ signal }).then((d) => d.overview), []);
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function runBilling() {
    setBusy(true);
    setError(null);
    try {
      const r = await generateBills(month);
      toast(`${monthLabel(r.month)}: ${r.created} new bills, ${r.skipped} already existed`);
      state.reload({ silent: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-wide">
      <PageHeader title="Platform overview" />
      <AsyncBlock state={state}>
        {(o) => (
          <>
            <div className="dash">
              <section className={`dash-card${o.pending_owners ? " is-due" : ""}`}>
                <h2>Owners waiting</h2>
                <p className="big-figure">{o.pending_owners}</p>
                <Link to="/admin/owners" className="link">Review owners</Link>
              </section>
              <section className={`dash-card${o.pending_listings ? " is-due" : ""}`}>
                <h2>Listings waiting</h2>
                <p className="big-figure">{o.pending_listings}</p>
                <Link to="/admin/listings" className="link">Review listings</Link>
              </section>
              <section className="dash-card">
                <h2>Rent this month</h2>
                <p className="big-figure">{rupees(o.collected_this_month)}</p>
                <p>collected, {rupees(o.due_this_month)} still due</p>
              </section>
            </div>

            <div className="table-wrap">
              <table className="table table-plain">
                <caption className="sr-only">Platform numbers</caption>
                <tbody>
                  <tr><th scope="row">Live listings</th><td className="num">{o.live_listings}</td></tr>
                  <tr><th scope="row">Approved owners</th><td className="num">{o.owners}</td></tr>
                  <tr><th scope="row">Registered tenants</th><td className="num">{o.tenants}</td></tr>
                  <tr><th scope="row">Tenants living in a room</th><td className="num">{o.active_tenants}</td></tr>
                  <tr><th scope="row">Beds on the platform</th><td className="num">{o.total_beds}</td></tr>
                  <tr><th scope="row">Open booking requests</th><td className="num">{o.pending_bookings}</td></tr>
                  {o.by_city.map((c) => (
                    <tr key={c.city}><th scope="row">Live in {c.city}</th><td className="num">{c.listings}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AsyncBlock>

      <section className="form-card stack admin-billing">
        <h2>Generate bills manually</h2>
        <p className="muted">
          The worker does this automatically at 2 AM on the 1st. Run it by hand only if that job failed. It's safe to run
          twice: existing bills are skipped.
        </p>
        <div className="row-start">
          <label className="inline-label">
            <span>Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <Button variant="secondary" loading={busy} onClick={runBilling} disabled={!month}>
            Generate bills for {month ? monthLabel(month) : "month"}
          </Button>
        </div>
        <InlineError error={error} />
      </section>
    </div>
  );
}
