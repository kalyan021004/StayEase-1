import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { exportOwnerBills, ownerBills } from "../../api/bills";
import { myListings } from "../../api/pgs";
import { useAsync } from "../../hooks/useAsync";
import { currentMonth, monthLabel, rupees, shortDate } from "../../lib/format";
import { AsyncBlock, Button, EmptyState, InlineError, PageHeader, StatusChip, useToast } from "../../components/ui";

export default function OwnerBills() {
  const [params, setParams] = useSearchParams();
  const pgId = params.get("pgId") || "";
  const month = params.has("month") ? params.get("month") : currentMonth();
  const filters = { pgId: pgId || undefined, month: month || undefined };

  const listings = useAsync((signal) => myListings({ signal }).then((d) => d.pgs), []);
  const bills = useAsync((signal) => ownerBills(filters, { signal }).then((d) => d.bills), [pgId, month]);
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  function update(k, v) {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
    setExportError(null);
  }

  async function doExport() {
    setExporting(true);
    setExportError(null);
    try {
      const { url, rowCount } = await exportOwnerBills(filters);
      // Signed link, valid for 5 minutes - start the download straight away.
      window.location.assign(url);
      toast(`Downloading ${rowCount} rows`);
    } catch (err) {
      setExportError(err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page page-wide">
      <PageHeader
        title="Rent"
        subtitle="Bills are generated automatically on the 1st. Tenants pay online and the status updates here."
        actions={
          <Button variant="secondary" loading={exporting} onClick={doExport}>
            Download Excel
          </Button>
        }
      />
      <div className="toolbar">
        <label>
          <span>PG</span>
          <select value={pgId} onChange={(e) => update("pgId", e.target.value)}>
            <option value="">All my PGs</option>
            {(listings.data || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Month</span>
          <input type="month" value={month} onChange={(e) => update("month", e.target.value)} />
        </label>
        {month && (
          <button className="link" onClick={() => update("month", "")}>
            Show all months
          </button>
        )}
      </div>
      <InlineError error={exportError} />

      <AsyncBlock
        state={bills}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title={month ? `No bills for ${monthLabel(month)}` : "No bills yet"}
            message="Bills are created for every tenant living in your rooms on the 1st of the month."
          />
        }
      >
        {(rows) => {
          const total = rows.reduce((s, b) => s + b.amount, 0);
          const paid = rows.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0);
          return (
            <>
              <div className="totals">
                <div>
                  <span>Billed</span>
                  <strong>{rupees(total)}</strong>
                </div>
                <div>
                  <span>Collected</span>
                  <strong className="ok">{rupees(paid)}</strong>
                </div>
                <div>
                  <span>Still due</span>
                  <strong className={total - paid > 0 ? "due" : ""}>{rupees(total - paid)}</strong>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Tenant</th>
                      <th scope="col">Room</th>
                      <th scope="col">Month</th>
                      <th scope="col" className="num">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Paid on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <tr key={b.id}>
                        <td data-label="Tenant">
                          <span className="cell">
                            <strong>{b.tenant_name}</strong>
                            <span className="muted small block">{b.tenant_phone || b.tenant_email}</span>
                          </span>
                        </td>
                        <td data-label="Room">
                          <span className="cell">
                            {b.room_number}
                            <span className="muted small block">{b.pg_name}</span>
                          </span>
                        </td>
                        <td data-label="Month">{monthLabel(b.month)}</td>
                        <td data-label="Amount" className="num">{rupees(b.amount)}</td>
                        <td data-label="Status">
                          <StatusChip status={b.status} />
                        </td>
                        <td data-label="Paid on">{b.paid_at ? shortDate(b.paid_at) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </AsyncBlock>
    </div>
  );
}
