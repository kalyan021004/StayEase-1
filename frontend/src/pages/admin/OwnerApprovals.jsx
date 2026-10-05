import { useState } from "react";
import { approveOwner, pendingOwners, rejectOwner } from "../../api/auth";
import { useAsync } from "../../hooks/useAsync";
import { shortDate } from "../../lib/format";
import { AsyncBlock, Button, EmptyState, PageHeader, useToast } from "../../components/ui";

export default function OwnerApprovals() {
  const state = useAsync((signal) => pendingOwners({ signal }).then((d) => d.owners), []);
  const toast = useToast();
  const [busy, setBusy] = useState({});

  async function act(o, action) {
    setBusy((b) => ({ ...b, [o.id]: action }));
    try {
      await (action === "approve" ? approveOwner(o.id) : rejectOwner(o.id));
      state.setData((list) => list.filter((x) => x.id !== o.id));
      toast(action === "approve" ? `${o.name} can now log in and list PGs` : `${o.name} rejected`);
    } catch (err) {
      toast(err.message, "error");
      state.reload({ silent: true });
    } finally {
      setBusy((b) => ({ ...b, [o.id]: undefined }));
    }
  }

  return (
    <div className="page">
      <PageHeader title="Owners waiting for approval" subtitle="Call or check the owner before approving. Approved owners can list PGs." />
      <AsyncBlock
        state={state}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="All caught up" message="No owner signups are waiting." />}
      >
        {(list) => (
          <ul className="card-list">
            {list.map((o) => (
              <li key={o.id} className="request">
                <div className="request-main">
                  <h3>{o.name}</h3>
                  <p>
                    {o.email}
                    {o.phone && (
                      <>
                        , <a href={`tel:${o.phone}`}>{o.phone}</a>
                      </>
                    )}
                  </p>
                  <p className="muted small">Signed up {shortDate(o.created_at)}</p>
                </div>
                <div className="request-actions">
                  <Button loading={busy[o.id] === "approve"} disabled={Boolean(busy[o.id])} onClick={() => act(o, "approve")}>
                    Approve
                  </Button>
                  <Button variant="secondary" loading={busy[o.id] === "reject"} disabled={Boolean(busy[o.id])} onClick={() => act(o, "reject")}>
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
