import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPg } from "../../api/pgs";
import { assignTenant, createRoom, deleteRoom, removeOccupant, roomBoard, updateRoom } from "../../api/rooms";
import { useAsync } from "../../hooks/useAsync";
import { SHARING_LABEL, rupees, shortDate, todayISO } from "../../lib/format";
import { Button, EmptyState, ErrorState, Field, InlineError, LoadingList, Modal, PageHeader, StatusChip, useToast } from "../../components/ui";

const CAPACITY_FOR = { single: 1, double: 2, triple: 3 };
const FILTERS = [
  ["all", "All rooms"],
  ["free", "Has a free bed"],
  ["occupied", "Full"],
];

export default function RoomBoard() {
  const { pgId } = useParams();
  const toast = useToast();
  const state = useAsync(async (signal) => {
    const [p, r] = await Promise.all([getPg(pgId, { signal }), roomBoard(pgId, { signal })]);
    return { pg: p.pg, rooms: r.rooms };
  }, [pgId]);

  const [filter, setFilter] = useState("all");
  const [openRoomId, setOpenRoomId] = useState(null);
  const [roomForm, setRoomForm] = useState(null); // null | {mode:'create'|'edit', ...}

  if (state.loading && !state.data) return <div className="page page-wide"><LoadingList rows={4} /></div>;
  if (state.error && !state.data) return <div className="page"><ErrorState error={state.error} onRetry={state.reload} /></div>;

  const { pg, rooms } = state.data;
  const refresh = () => state.reload({ silent: true });
  const openRoom = rooms.find((r) => r.id === openRoomId) || null;

  const beds = rooms.reduce((s, r) => s + r.capacity, 0);
  const filled = rooms.reduce((s, r) => s + r.occupants.length, 0);
  const shown = rooms.filter((r) =>
    filter === "all" ? true : filter === "free" ? r.occupants.length < r.capacity : r.occupants.length >= r.capacity
  );

  return (
    <div className="page page-wide">
      <Link to="/owner/listings" className="back-link">My PGs</Link>
      <PageHeader
        title={pg.name}
        subtitle={`${rooms.length} rooms, ${filled} of ${beds} beds filled`}
        actions={<Button onClick={() => setRoomForm({ mode: "create" })}>Add a room</Button>}
      />
      {pg.status !== "approved" && (
        <div className="banner banner-warn">
          This PG is {pg.status === "pending" ? "waiting for approval" : pg.status}. You can set up rooms now; tenants will
          see them once it's live.
        </div>
      )}

      {rooms.length === 0 ? (
        <EmptyState
          title="No rooms yet"
          message="Add each room with its number, sharing type and rent per bed."
          action={<Button onClick={() => setRoomForm({ mode: "create" })}>Add a room</Button>}
        />
      ) : (
        <>
          <div className="board-bar">
            <div className="chips" role="group" aria-label="Show">
              {FILTERS.map(([v, l]) => (
                <button key={v} className={`chip-btn${filter === v ? " on" : ""}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>
                  {l}
                </button>
              ))}
            </div>
            <ul className="legend" aria-label="Legend">
              <li><span className="dot dot-vacant" /> Vacant</li>
              <li><span className="dot dot-partial" /> Partly filled</li>
              <li><span className="dot dot-occupied" /> Full</li>
            </ul>
          </div>

          <div className="key-board">
            {shown.map((r) => (
              <button key={r.id} className={`key-tag key-${r.status}`} onClick={() => setOpenRoomId(r.id)}>
                <span className="key-hole" aria-hidden="true" />
                <span className="key-no">{r.room_number}</span>
                <span className="key-type">{SHARING_LABEL[r.sharing_type] || r.sharing_type}</span>
                <span className="key-beds" aria-label={`${r.occupants.length} of ${r.capacity} beds filled`}>
                  {Array.from({ length: r.capacity }).map((_, i) => (
                    <span key={i} className={i < r.occupants.length ? "bed on" : "bed"} />
                  ))}
                </span>
                <span className="key-names">
                  {r.occupants.length ? r.occupants.map((o) => o.tenantName.split(" ")[0]).join(", ") : "Empty"}
                </span>
                <span className="key-rent">{rupees(r.rent_amount)}</span>
              </button>
            ))}
            {shown.length === 0 && <p className="muted">No rooms match this filter.</p>}
          </div>
        </>
      )}

      <RoomDrawer
        room={openRoom}
        onClose={() => setOpenRoomId(null)}
        onChanged={refresh}
        onEdit={(r) => setRoomForm({ mode: "edit", room: r })}
        toast={toast}
      />
      <RoomFormModal
        state={roomForm}
        pgId={pgId}
        onClose={() => setRoomForm(null)}
        onSaved={(msg) => {
          setRoomForm(null);
          toast(msg);
          refresh();
        }}
      />
    </div>
  );
}

function RoomDrawer({ room, onClose, onChanged, onEdit, toast }) {
  const [email, setEmail] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const reset = () => {
    setEmail("");
    setMoveIn("");
    setError(null);
    setConfirmRemove(null);
  };

  if (!room) return <Modal open={false} onClose={onClose} title="" />;
  const free = room.capacity - room.occupants.length;

  async function assign(e) {
    e.preventDefault();
    setBusy("assign");
    setError(null);
    try {
      await assignTenant(room.id, email.trim(), moveIn || undefined);
      toast(`Tenant added to room ${room.room_number}`);
      reset();
      onChanged();
    } catch (err) {
      setError(err);
      if (err.status === 409) onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function remove(o) {
    setBusy(`rm-${o.occupantId}`);
    setError(null);
    try {
      await removeOccupant(room.id, o.occupantId);
      toast(`${o.tenantName} moved out of room ${room.room_number}`);
      setConfirmRemove(null);
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function del() {
    setBusy("delete");
    setError(null);
    try {
      await deleteRoom(room.id);
      toast(`Room ${room.room_number} deleted`);
      onClose();
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open title={`Room ${room.room_number}`} onClose={() => (reset(), onClose())}>
      <div className="stack">
        <p className="room-summary">
          <StatusChip status={room.status} /> {SHARING_LABEL[room.sharing_type]}, {room.capacity}{" "}
          {room.capacity === 1 ? "bed" : "beds"}, {rupees(room.rent_amount)} per bed a month
        </p>

        <section>
          <h3 className="h-small">Living here</h3>
          {room.occupants.length === 0 ? (
            <p className="muted">Nobody yet.</p>
          ) : (
            <ul className="occupants">
              {room.occupants.map((o) => (
                <li key={o.occupantId}>
                  <div>
                    <strong>{o.tenantName}</strong>
                    <span className="muted small">
                      {o.tenantEmail}
                      {o.tenantPhone && <>, {o.tenantPhone}</>}. Since {shortDate(o.moveInDate)}
                    </span>
                  </div>
                  {confirmRemove === o.occupantId ? (
                    <span className="confirm-inline">
                      <Button size="sm" variant="danger" loading={busy === `rm-${o.occupantId}`} onClick={() => remove(o)}>
                        Yes, moved out
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        No
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(o.occupantId)}>
                      Mark moved out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {free > 0 ? (
          <form className="assign-form stack" onSubmit={assign}>
            <h3 className="h-small">
              Add a tenant ({free} {free === 1 ? "bed" : "beds"} free)
            </h3>
            <p className="muted small">They need a StayEase tenant account. Use the email they signed up with.</p>
            <Field label="Tenant's email">
              {(p) => <input type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} {...p} />}
            </Field>
            <Field label="Move-in date" hint="Leave empty for today.">
              {(p) => <input type="date" value={moveIn} max={todayISO().slice(0, 4) + "-12-31"} onChange={(e) => setMoveIn(e.target.value)} {...p} />}
            </Field>
            <Button type="submit" loading={busy === "assign"} disabled={!email.trim()}>
              Add to room {room.room_number}
            </Button>
          </form>
        ) : (
          <p className="muted">This room is full.</p>
        )}

        <InlineError error={error} />

        <div className="row-between">
          <Button variant="secondary" size="sm" onClick={() => onEdit(room)}>
            Edit room
          </Button>
          <Button
            variant="danger-ghost"
            size="sm"
            loading={busy === "delete"}
            disabled={room.occupants.length > 0}
            title={room.occupants.length > 0 ? "Move tenants out before deleting" : undefined}
            onClick={del}
          >
            Delete room
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RoomFormModal({ state, pgId, onClose, onSaved }) {
  const editing = state?.mode === "edit";
  const initial = editing
    ? {
        roomNumber: state.room.room_number,
        sharingType: state.room.sharing_type,
        rentAmount: String(state.room.rent_amount),
        capacity: String(state.room.capacity),
      }
    : { roomNumber: "", sharingType: "double", rentAmount: "", capacity: "2" };

  return (
    <Modal open={Boolean(state)} title={editing ? `Edit room ${state.room.room_number}` : "Add a room"} onClose={onClose}>
      {state && <RoomForm key={editing ? state.room.id : "new"} initial={initial} editing={editing} state={state} pgId={pgId} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function RoomForm({ initial, editing, state, pgId, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      roomNumber: f.roomNumber.trim(),
      sharingType: f.sharingType,
      rentAmount: Number(f.rentAmount),
      capacity: Number(f.capacity),
    };
    try {
      if (editing) {
        await updateRoom(state.room.id, body);
        onSaved(`Room ${body.roomNumber} updated`);
      } else {
        await createRoom(pgId, body);
        onSaved(`Room ${body.roomNumber} added`);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="grid-2">
        <Field label="Room number">
          {(p) => <input required maxLength={20} value={f.roomNumber} onChange={set("roomNumber")} placeholder="101" {...p} />}
        </Field>
        <Field label="Sharing">
          {(p) => (
            <select
              value={f.sharingType}
              onChange={(e) =>
                setF((x) => ({ ...x, sharingType: e.target.value, capacity: String(CAPACITY_FOR[e.target.value]) }))
              }
              {...p}
            >
              <option value="single">Single</option>
              <option value="double">2 sharing</option>
              <option value="triple">3 sharing</option>
            </select>
          )}
        </Field>
        <Field label="Rent per bed (₹/month)">
          {(p) => <input type="number" inputMode="numeric" min="1" step="100" required value={f.rentAmount} onChange={set("rentAmount")} placeholder="7500" {...p} />}
        </Field>
        <Field label="Beds in room">
          {(p) => <input type="number" inputMode="numeric" min="1" max="10" required value={f.capacity} onChange={set("capacity")} {...p} />}
        </Field>
      </div>
      <InlineError error={error} />
      <div className="row-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {editing ? "Save room" : "Add room"}
        </Button>
      </div>
    </form>
  );
}
