import { useState } from "react";
import { Link } from "react-router-dom";
import { cancelBooking, myBookings } from "../../api/bookings";
import { useAsync } from "../../hooks/useAsync";
import { SHARING_LABEL, rupees, shortDate } from "../../lib/format";
import { AsyncBlock, Button, EmptyState, PageHeader, StatusChip, useToast } from "../../components/ui";

const EXPLAIN = {
  pending: "Waiting for the owner to reply.",
  confirmed: "You're in. Your rent bill will show up under Rent.",
  rejected: "The owner couldn't take this request, or the room filled up.",
  cancelled: "This request was cancelled.",
};

export default function MyBookings() {
  const state = useAsync((signal) => myBookings({ signal }).then((d) => d.bookings), []);
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  async function cancel(b) {
    setBusyId(b.id);
    try {
      const { booking } = await cancelBooking(b.id);
      state.setData((list) => list.map((x) => (x.id === b.id ? { ...x, status: booking.status } : x)));
      toast("Request cancelled");
    } catch (err) {
      toast(err.message, "error");
      state.reload({ silent: true });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Your requests" subtitle="Rooms you've asked to move into." />
      <AsyncBlock
        state={state}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="No requests yet"
            message="Find a PG you like and request a room. The owner gets it instantly."
            action={
              <Link to="/search" className="btn btn-primary">
                Find a PG
              </Link>
            }
          />
        }
      >
        {(list) => (
          <ul className="card-list">
            {list.map((b) => (
              <li key={b.id} className={`booking booking-${b.status}`}>
                <div className="booking-main">
                  <Link to={`/pg/${b.pg_id}`} className="booking-title">
                    {b.pg_name}
                  </Link>
                  <p>
                    Room {b.room_number}, {SHARING_LABEL[b.sharing_type]?.toLowerCase()} in {b.city},{" "}
                    {rupees(b.rent_amount)}/month
                  </p>
                  <p className="muted small">
                    Requested {shortDate(b.created_at)}
                    {b.move_in_date && <>. Move-in {shortDate(b.move_in_date)}</>}
                  </p>
                  <p className="small">{EXPLAIN[b.status]}</p>
                </div>
                <div className="booking-side">
                  <StatusChip status={b.status} />
                  {b.status === "pending" && (
                    <Button variant="ghost" size="sm" loading={busyId === b.id} onClick={() => cancel(b)}>
                      Cancel request
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </div>
  );
}
