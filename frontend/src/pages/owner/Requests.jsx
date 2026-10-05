import { useState } from "react";
import { confirmBooking, pendingRequests, rejectBooking } from "../../api/bookings";
import { useAsync } from "../../hooks/useAsync";
import { SHARING_LABEL, rupees, shortDate } from "../../lib/format";
import { AsyncBlock, Button, EmptyState, PageHeader, useToast } from "../../components/ui";

export default function Requests() {
  const state = useAsync((signal) => pendingRequests({ signal }).then((d) => d.bookings), []);
  const toast = useToast();
  const [busy, setBusy] = useState({}); // { [id]: "confirm" | "reject" }
  // { [id]: { tone, message, booking } } - resolved requests stay on screen with
  // their outcome until the user leaves the page.
  const [outcomes, setOutcomes] = useState({});
  const resolve = (b, tone, message) => setOutcomes((o) => ({ ...o, [b.id]: { tone, message, booking: b } }));

  async function act(b, action) {
    setBusy((s) => ({ ...s, [b.id]: action }));
    try {
      if (action === "confirm") {
        await confirmBooking(b.id);
        resolve(b, "ok", `${b.tenant_name} is in room ${b.room_number}.`);
        toast(`Confirmed. ${b.tenant_name} can move in.`);
      } else {
        await rejectBooking(b.id);
        resolve(b, "muted", "Declined. The tenant will see this under their requests.");
      }
    } catch (err) {
      if (err.status === 409) {
        // Room filled up (another request or a manual add got there first),
        // or the tenant moved elsewhere. The server has already closed this
        // request - explain it in place instead of a generic error.
        resolve(b, "warn", err.message);
      } else {
        toast(err.message, "error");
      }
    } finally {
      setBusy((s) => ({ ...s, [b.id]: undefined }));
      // Other requests for the same room may have changed - refresh quietly.
      state.reload({ silent: true });
    }
  }

  return (
    <div className="page">
      <PageHeader title="Booking requests" subtitle="Oldest first. Confirming adds the tenant to the room right away." />
      <AsyncBlock
        state={state}
        isEmpty={(d) => d.length === 0 && Object.keys(outcomes).length === 0}
        empty={<EmptyState title="No requests right now" message="When a tenant requests one of your rooms, it shows up here." />}
      >
        {(data) => {
          const liveIds = new Set(data.map((b) => b.id));
          const resolvedGone = Object.values(outcomes)
            .filter((o) => !liveIds.has(o.booking.id))
            .map((o) => o.booking);
          const cards = [...data, ...resolvedGone];
          return (
            <ul className="card-list">
              {cards.map((b) => {
                const outcome = outcomes[b.id];
                const full = b.beds_free <= 0;
                return (
                  <li key={b.id} className={`request${outcome ? ` request-${outcome.tone}` : ""}`}>
                    <div className="request-main">
                      <h3>{b.tenant_name}</h3>
                      <p className="muted small">
                        {b.tenant_email}
                        {b.tenant_phone && (
                          <>
                            , <a href={`tel:${b.tenant_phone}`}>{b.tenant_phone}</a>
                          </>
                        )}
                      </p>
                      <p>
                        Wants <strong>room {b.room_number}</strong> at {b.pg_name} ({SHARING_LABEL[b.sharing_type]?.toLowerCase()},{" "}
                        {rupees(b.rent_amount)})
                      </p>
                      <p className="muted small">
                        Asked {shortDate(b.created_at)}
                        {b.move_in_date ? `. Moving in ${shortDate(b.move_in_date)}` : ". Flexible move-in"}
                      </p>
                      {!outcome && full && (
                        <p className="note-warn">Room {b.room_number} looks full now. Confirming will fail unless someone has moved out.</p>
                      )}
                      {outcome && <p className={`outcome outcome-${outcome.tone}`} role="status">{outcome.message}</p>}
                    </div>
                    {!outcome && (
                      <div className="request-actions">
                        <Button loading={busy[b.id] === "confirm"} disabled={Boolean(busy[b.id])} onClick={() => act(b, "confirm")}>
                          Confirm
                        </Button>
                        <Button variant="secondary" loading={busy[b.id] === "reject"} disabled={Boolean(busy[b.id])} onClick={() => act(b, "reject")}>
                          Decline
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        }}
      </AsyncBlock>
    </div>
  );
}
