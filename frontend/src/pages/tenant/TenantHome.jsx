import { Link } from "react-router-dom";
import { myBills } from "../../api/bills";
import { myBookings } from "../../api/bookings";
import { useAuth } from "../../auth/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { monthLabel, rupees, shortDate } from "../../lib/format";
import { ErrorState, LoadingList, PageHeader, StatusChip } from "../../components/ui";

export default function TenantHome() {
  const { user } = useAuth();
  const state = useAsync(
    async (signal) => {
      const [b, k] = await Promise.all([myBills({ signal }), myBookings({ signal })]);
      return { bills: b.bills, bookings: k.bookings };
    },
    []
  );

  return (
    <div className="page">
      <PageHeader title={`Hi ${user.name.split(" ")[0]}`} />
      {state.loading && !state.data ? (
        <LoadingList rows={3} />
      ) : state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : (
        <Overview {...state.data} />
      )}
    </div>
  );
}

function Overview({ bills, bookings }) {
  const due = bills.filter((b) => b.status === "unpaid");
  const dueTotal = due.reduce((s, b) => s + Number(b.amount), 0);
  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.find((b) => b.status === "confirmed");
  // Current stay: latest confirmed booking, else the room on the latest bill (manual assignment).
  const stay = confirmed
    ? { pg: confirmed.pg_name, room: confirmed.room_number, city: confirmed.city, pgId: confirmed.pg_id }
    : bills[0]
      ? { pg: bills[0].pg_name, room: bills[0].room_number, city: bills[0].city }
      : null;

  return (
    <div className="dash">
      <section className={`dash-card rent-card${due.length ? " is-due" : ""}`}>
        <h2>Rent</h2>
        {due.length ? (
          <>
            <p className="big-figure">{rupees(dueTotal)}</p>
            <p>
              Due for {due.map((b) => monthLabel(b.month)).join(", ")}
              {due[0].due_date && <> by {shortDate(due[0].due_date)}</>}
            </p>
            <Link to="/tenant/bills" className="btn btn-primary">
              Pay rent
            </Link>
          </>
        ) : bills.length ? (
          <p>You're all paid up. Next bill arrives on the 1st.</p>
        ) : (
          <p className="muted">Bills appear here once you've moved into a room.</p>
        )}
      </section>

      <section className="dash-card">
        <h2>Where you stay</h2>
        {stay ? (
          <>
            <p className="dash-strong">{stay.pg}</p>
            <p>
              Room {stay.room}
              {stay.city && <>, {stay.city}</>}
            </p>
            {stay.pgId && (
              <Link to={`/pg/${stay.pgId}`} className="link">
                View PG
              </Link>
            )}
          </>
        ) : (
          <>
            <p className="muted">You haven't moved in anywhere yet.</p>
            <Link to="/search" className="btn btn-secondary">
              Find a PG
            </Link>
          </>
        )}
      </section>

      <section className="dash-card dash-wide">
        <div className="section-head">
          <h2>Your requests</h2>
          <Link to="/tenant/bookings" className="link">
            See all
          </Link>
        </div>
        {bookings.length === 0 ? (
          <p className="muted">No requests yet. Open any PG and tap Request room.</p>
        ) : (
          <ul className="plain-list">
            {(pending.length ? pending : bookings.slice(0, 3)).map((b) => (
              <li key={b.id} className="list-line">
                <span>
                  <strong>{b.pg_name}</strong>, room {b.room_number}
                </span>
                <StatusChip status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
