import { useCallback } from "react";
import { myBills } from "../../api/bills";
import { useAuth } from "../../auth/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { usePayBill } from "../../hooks/usePayBill";
import { monthLabel, rupees, shortDate, todayISO } from "../../lib/format";
import { AsyncBlock, Button, EmptyState, PageHeader, StatusChip, useToast } from "../../components/ui";

export default function MyBills() {
  const { user } = useAuth();
  const toast = useToast();
  const state = useAsync((signal) => myBills({ signal }).then((d) => d.bills), []);
  const { setData, reload } = state;

  const { pay, payingId, phase } = usePayBill({
    user,
    onPaid: useCallback(
      (bills, bill) => {
        setData(bills);
        toast(`Rent for ${monthLabel(bill.month)} paid. Thank you!`);
      },
      [setData, toast]
    ),
    onPending: useCallback(() => {
      toast("Payment received by Razorpay. It can take a minute to show as paid here.");
      reload({ silent: true });
    }, [reload, toast]),
    onError: useCallback((err) => toast(err.message, "error"), [toast]),
  });

  const today = todayISO();

  return (
    <div className="page">
      <PageHeader title="Rent" subtitle="Bills are created on the 1st of every month." />
      {phase === "confirming" && (
        <div className="banner banner-info" role="status">
          <span className="spinner" aria-hidden="true" /> Confirming your payment with the bank. Don't close this page.
        </div>
      )}
      <AsyncBlock
        state={state}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="No bills yet" message="Once you move into a room, your monthly rent shows up here." />}
      >
        {(bills) => (
          <ul className="card-list">
            {bills.map((b) => {
              const overdue = b.status === "unpaid" && b.due_date && b.due_date.slice(0, 10) < today;
              return (
                <li key={b.id} className={`bill bill-${overdue ? "overdue" : b.status}`}>
                  <div className="bill-main">
                    <h3>{monthLabel(b.month)}</h3>
                    <p>
                      {b.pg_name}, room {b.room_number}
                    </p>
                    <p className="muted small">
                      {b.status === "paid"
                        ? `Paid ${shortDate(b.paid_at)}${b.provider_ref ? `, ref ${b.provider_ref}` : ""}`
                        : `Due ${shortDate(b.due_date)}`}
                    </p>
                  </div>
                  <div className="bill-side">
                    <strong className="bill-amount">{rupees(b.amount)}</strong>
                    {b.status === "paid" ? (
                      <StatusChip status="paid" />
                    ) : (
                      <>
                        {overdue && <StatusChip status="overdue" />}
                        <Button
                          loading={payingId === b.id}
                          disabled={payingId !== null && payingId !== b.id}
                          onClick={() => pay(b)}
                        >
                          Pay {rupees(b.amount)}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncBlock>
    </div>
  );
}
