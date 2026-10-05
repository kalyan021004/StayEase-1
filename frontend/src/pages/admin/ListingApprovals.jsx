import { useState } from "react";
import { Link } from "react-router-dom";
import { approveListing, pendingListings, rejectListing } from "../../api/pgs";
import { useAsync } from "../../hooks/useAsync";
import { GENDER_LABEL, shortDate } from "../../lib/format";
import { AsyncBlock, Button, EmptyState, PageHeader, useToast } from "../../components/ui";

export default function ListingApprovals() {
  const state = useAsync((signal) => pendingListings({ signal }).then((d) => d.pgs), []);
  const toast = useToast();
  const [busy, setBusy] = useState({});

  async function act(p, action) {
    setBusy((b) => ({ ...b, [p.id]: action }));
    try {
      await (action === "approve" ? approveListing(p.id) : rejectListing(p.id));
      state.setData((list) => list.filter((x) => x.id !== p.id));
      toast(action === "approve" ? `${p.name} is live` : `${p.name} rejected`);
    } catch (err) {
      toast(err.message, "error");
      state.reload({ silent: true });
    } finally {
      setBusy((b) => ({ ...b, [p.id]: undefined }));
    }
  }

  return (
    <div className="page">
      <PageHeader title="Listings waiting for approval" subtitle="Check the address and details look real before approving." />
      <AsyncBlock
        state={state}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="All caught up" message="No new listings are waiting." />}
      >
        {(list) => (
          <ul className="card-list">
            {list.map((p) => (
              <li key={p.id} className="request">
                <div className="request-main">
                  <h3>{p.name}</h3>
                  <p>
                    {p.address}, {p.city}
                  </p>
                  <p className="muted small">
                    {GENDER_LABEL[p.gender_type]}. {p.total_rooms} rooms added. Owner {p.owner_name} ({p.owner_email}
                    {p.owner_phone ? `, ${p.owner_phone}` : ""}). Submitted {shortDate(p.created_at)}.
                  </p>
                  {(p.amenities || []).length > 0 && <p className="small">{p.amenities.join(", ")}</p>}
                  <Link to={`/pg/${p.id}`} className="link">
                    Preview listing
                  </Link>
                </div>
                <div className="request-actions">
                  <Button loading={busy[p.id] === "approve"} disabled={Boolean(busy[p.id])} onClick={() => act(p, "approve")}>
                    Approve
                  </Button>
                  <Button variant="secondary" loading={busy[p.id] === "reject"} disabled={Boolean(busy[p.id])} onClick={() => act(p, "reject")}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </div>
  );
}
