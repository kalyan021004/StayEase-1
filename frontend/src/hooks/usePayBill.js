import { useCallback, useState } from "react";
import { createOrder } from "../api/payments";
import { myBills } from "../api/bills";
import { openCheckout } from "../lib/razorpay";
import { monthLabel } from "../lib/format";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Pay one bill with Razorpay Checkout.
 * The browser's "success" is NOT trusted: the bill is marked paid by our
 * webhook, so after Checkout closes we poll /bills/mine until it flips.
 * Returns { pay, payingId, phase }   phase: idle | opening | confirming
 */
export function usePayBill({ user, onPaid, onError, onPending }) {
  const [payingId, setPayingId] = useState(null);
  const [phase, setPhase] = useState("idle");

  const pay = useCallback(
    async (bill) => {
      setPayingId(bill.id);
      setPhase("opening");
      try {
        const { order, keyId } = await createOrder(bill.id);
        const outcome = await openCheckout({
          order,
          keyId,
          user,
          description: `Rent for ${monthLabel(bill.month)}, room ${bill.room_number}`,
        });
        if (outcome === "dismissed") return;

        setPhase("confirming");
        for (let i = 0; i < 15; i++) {
          await sleep(2000);
          const { bills } = await myBills();
          const fresh = bills.find((b) => b.id === bill.id);
          if (fresh && fresh.status === "paid") {
            onPaid?.(bills, bill);
            return;
          }
        }
        onPending?.(bill);
      } catch (err) {
        onError?.(err);
      } finally {
        setPayingId(null);
        setPhase("idle");
      }
    },
    [user, onPaid, onError, onPending]
  );

  return { pay, payingId, phase };
}
