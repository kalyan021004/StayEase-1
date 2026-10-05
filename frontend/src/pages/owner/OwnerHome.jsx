import { Link } from "react-router-dom";
import { myListings } from "../../api/pgs";
import { pendingRequests } from "../../api/bookings";
import { ownerBills } from "../../api/bills";
import { useAuth } from "../../auth/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { currentMonth, monthLabel, rupees } from "../../lib/format";
import { EmptyState, ErrorState, LoadingList, PageHeader, StatusChip } from "../../components/ui";

export default function OwnerHome() {
  const { user } = useAuth();
  const month = currentMonth();
  const state = useAsync(
    async (signal) => {
      const [l, r, b] = await Promise.all([
        myListings({ signal }),
        pendingRequests({ signal }),
        ownerBills({ month }, { signal }),
      ]);
      return { pgs: l.pgs, requests: r.bookings, bills: b.bills };
    },
    [month]
  );

  return (
    <div className="page">
      <PageHeader
        title={`Namaste, ${user.name.split(" ")[0]}`}
        actions={
          <Link to="/owner/listings/new" className="btn btn-secondary">
            Add a PG
          </Link>
        }
      />
      {state.loading && !state.data ? (
        <LoadingList rows={3} />
      ) : state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : (
        <Summary {...state.data} month={month} />
      )}
    </div>
  );
}

function Summary({ pgs, requests, bills, month }) {
  if (pgs.length === 0) {
    return (
      <EmptyState
        title="Add your first PG"
        message="Tell us the name, area and who it's for. Then add rooms with their rent. Our team approves new listings within a day."
        action={
          <Link to="/owner/listings/new" className="btn btn-primary">
            Add a PG
          </Link>
        }
      />
    );
  }
  const beds = pgs.reduce((s, p) => s + p.total_beds, 0);
  const filled = pgs.reduce((s, p) => s + p.occupied_beds, 0);
  const collected = bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0);
  const due = bills.filter((b) => b.status === "unpaid");
  const dueAmount = due.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="dash">
      <section className={`dash-card${requests.length ? " is-due" : ""}`}>
        <h2>New requests</h2>
        <p className="big-figure">{requests.length}</p>
        <p>{requests.length ? "People are waiting for your reply." : "Nothing waiting right now."}</p>
        {requests.length > 0 && (
          <Link to="/owner/requests" className="btn btn-primary">
            Reply to requests
          </Link>
        )}
      </section>

      <section className="dash-card">
        <h2>Beds</h2>
        <p className="big-figure">
          {filled}
          <span className="of"> of {beds} filled</span>
        </p>
        <div className="meter" role="img" aria-label={`${filled} of ${beds} beds filled`}>
          <span style={{ width: beds ? `${(filled / beds) * 100}%` : 0 }} />
        </div>
        <p>{beds - filled > 0 ? `${beds - filled} beds free to let` : "Every bed is taken"}</p>
      </section>

      <section className="dash-card">
        <h2>Rent for {monthLabel(month)}</h2>
        <p className="big-figure">{rupees(collected)}</p>
        <p>
          collected{dueAmount > 0 && <>, {rupees(dueAmount)} still due from {due.length} tenant{due.length > 1 ? "s" : ""}</>}
        </p>
        <Link to="/owner/bills" className="link">
          See rent sheet
        </Link>
      </section>

      <section className="dash-card dash-wide">
        <div className="section-head">
          <h2>Your PGs</h2>
          <Link to="/owner/listings" className="link">
            Manage
          </Link>
        </div>
        <ul className="plain-list">
          {pgs.map((p) => (
            <li key={p.id} className="list-line">
              <Link to={`/owner/listings/${p.id}/rooms`}>
                <strong>{p.name}</strong>
                <span className="muted">
                  {" "}
                  {p.occupied_beds}/{p.total_beds} beds
                </span>
              </Link>
              <StatusChip status={p.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
