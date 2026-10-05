import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getPg } from "../../api/pgs";
import { requestBooking } from "../../api/bookings";
import { useAuth } from "../../auth/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { GENDER_LABEL, SHARING_LABEL, bedsWord, locality, rupees, todayISO } from "../../lib/format";
import { Button, ErrorState, Field, InlineError, LoadingList, Modal, StatusChip, useToast } from "../../components/ui";

export default function PgDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const state = useAsync((signal) => getPg(id, { signal }), [id]);

  const [room, setRoom] = useState(null);
  const [moveIn, setMoveIn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (state.loading && !state.data) {
    return (
      <div className="page">
        <LoadingList rows={4} label="Loading PG" />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="page">
        <ErrorState
          title={state.error.status === 404 ? "This PG isn't available" : "This PG didn't load"}
          error={state.error}
          onRetry={state.error.status === 404 ? undefined : state.reload}
        />
        <p className="center">
          <Link to="/search" className="link">
            Back to search
          </Link>
        </p>
      </div>
    );
  }

  const pg = state.data.pg;
  const rooms = pg.rooms || [];
  const freeBeds = rooms.reduce((s, r) => s + Math.max(0, r.beds_free), 0);
  const isTenantOrGuest = !user || user.role === "tenant";

  function startRequest(r) {
    if (!user) {
      navigate("/login", { state: { from: location.pathname, reason: "Log in as a tenant to request a room." } });
      return;
    }
    setError(null);
    setMoveIn("");
    setRoom(r);
  }

  async function submitRequest(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestBooking(room.id, moveIn || undefined);
      setRoom(null);
      toast("Request sent. You'll see the owner's answer under Requests.");
      navigate("/tenant/bookings");
    } catch (err) {
      setError(err);
      if (err.status === 409) state.reload({ silent: true }); // room may have filled up
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <Link to="/search" className="back-link">
        All PGs
      </Link>

      {pg.status !== "approved" && (
        <div className="banner banner-warn">
          Only you can see this page. It goes live after our team approves the listing.
        </div>
      )}

      <header className="detail-head">
        <div>
          <h1>{pg.name}</h1>
          <p className="detail-where">
            {locality(pg.address)}, {pg.city}
          </p>
          <p className="detail-address">{pg.address}</p>
        </div>
        <div className="detail-facts">
          <span className={`gender gender-${pg.gender_type}`}>{GENDER_LABEL[pg.gender_type]}</span>
          {freeBeds > 0 ? (
            <span className="tolet-tag tolet-inline">{bedsWord(freeBeds)} to-let</span>
          ) : (
            <span className="full-tag">House full</span>
          )}
        </div>
      </header>

      {(pg.photos || []).length > 0 && (
        <div className="photo-strip">
          {pg.photos.map((src) => (
            <img key={src} src={src} alt={`${pg.name}`} loading="lazy" />
          ))}
        </div>
      )}

      {(pg.amenities || []).length > 0 && (
        <section className="detail-section">
          <h2>What's included</h2>
          <ul className="amenities">
            {pg.amenities.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="detail-section">
        <h2>Rooms</h2>
        {rooms.length === 0 ? (
          <p className="muted">The owner hasn't added rooms yet.</p>
        ) : (
          <ul className="room-list">
            {rooms.map((r) => (
              <li key={r.id} className={`room-row${r.beds_free <= 0 ? " is-full" : ""}`}>
                <div className="room-id">
                  <strong>Room {r.room_number}</strong>
                  <span>{SHARING_LABEL[r.sharing_type] || r.sharing_type}</span>
                </div>
                <div className="room-beds">
                  {r.beds_free > 0 ? (
                    <span className="beds-free">
                      {r.beds_free} of {r.capacity} free
                    </span>
                  ) : (
                    <StatusChip status="occupied" />
                  )}
                </div>
                <div className="room-rent">
                  <strong>{rupees(r.rent_amount)}</strong>
                  <small>per bed / month</small>
                </div>
                {isTenantOrGuest && (
                  <div className="room-cta">
                    <Button size="sm" disabled={r.beds_free <= 0} onClick={() => startRequest(r)}>
                      {r.beds_free > 0 ? "Request room" : "Full"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={Boolean(room)}
        title={room ? `Request room ${room.room_number}` : ""}
        onClose={() => setRoom(null)}
      >
        {room && (
          <form onSubmit={submitRequest} className="stack">
            <p>
              {SHARING_LABEL[room.sharing_type]} at {pg.name}, <strong>{rupees(room.rent_amount)}</strong> a month. The
              owner will confirm or decline your request.
            </p>
            <Field label="When do you want to move in?" hint="Optional. Leave empty if you're flexible.">
              {(p) => (
                <input type="date" min={todayISO()} value={moveIn} onChange={(e) => setMoveIn(e.target.value)} {...p} />
              )}
            </Field>
            <InlineError error={error} />
            <div className="row-end">
              <Button type="button" variant="ghost" onClick={() => setRoom(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Send request
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
