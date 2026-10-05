import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteListing, myListings } from "../../api/pgs";
import { useAsync } from "../../hooks/useAsync";
import { GENDER_LABEL, rupees, shortDate } from "../../lib/format";
import { AsyncBlock, Button, EmptyState, InlineError, Modal, PageHeader, StatusChip, useToast } from "../../components/ui";

const STATUS_NOTE = {
  pending: "Waiting for approval. Tenants can't see it yet.",
  approved: "Live. Tenants can find and book it.",
  rejected: "Not approved. Check the details and contact support.",
  suspended: "Hidden from tenants by our team.",
};

export default function Listings() {
  const state = useAsync((signal) => myListings({ signal }).then((d) => d.pgs), []);
  const toast = useToast();
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteListing(toDelete.id);
      state.setData((list) => list.filter((p) => p.id !== toDelete.id));
      toast(`${toDelete.name} deleted`);
      setToDelete(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="My PGs"
        actions={
          <Link to="/owner/listings/new" className="btn btn-primary">
            Add a PG
          </Link>
        }
      />
      <AsyncBlock
        state={state}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="No PGs yet"
            message="Add your PG with its address and who it's for. You'll add rooms next."
            action={
              <Link to="/owner/listings/new" className="btn btn-primary">
                Add a PG
              </Link>
            }
          />
        }
      >
        {(list) => (
          <ul className="card-list">
            {list.map((p) => (
              <li key={p.id} className="listing">
                <div className="listing-main">
                  <div className="listing-title">
                    <h3>{p.name}</h3>
                    <StatusChip status={p.status} />
                  </div>
                  <p>
                    {p.address}, {p.city}
                  </p>
                  <p className="muted small">
                    {GENDER_LABEL[p.gender_type]}. {p.total_rooms} rooms, {p.occupied_beds} of {p.total_beds} beds filled
                    {p.min_rent ? <>, from {rupees(p.min_rent)}</> : null}. Added {shortDate(p.created_at)}.
                  </p>
                  <p className="small">{STATUS_NOTE[p.status]}</p>
                </div>
                <div className="listing-actions">
                  <Link to={`/owner/listings/${p.id}/rooms`} className="btn btn-primary btn-sm">
                    Rooms and tenants
                  </Link>
                  <Link to={`/owner/listings/${p.id}/edit`} className="btn btn-secondary btn-sm">
                    Edit details
                  </Link>
                  <Link to={`/pg/${p.id}`} className="btn btn-ghost btn-sm">
                    Preview
                  </Link>
                  <Button variant="danger-ghost" size="sm" onClick={() => (setError(null), setToDelete(p))}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>

      <Modal
        open={Boolean(toDelete)}
        title="Delete this PG?"
        onClose={() => setToDelete(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmDelete}>
              Delete PG
            </Button>
          </>
        }
      >
        {toDelete && (
          <>
            <p>
              <strong>{toDelete.name}</strong>, its rooms, requests and bill history will be removed. This can't be undone.
            </p>
            <InlineError error={error} />
          </>
        )}
      </Modal>
    </div>
  );
}
