// Billing business logic.
const billRepo = require("../repositories/bill.repository");
const AppError = require("../utils/AppError");

const RENT_DUE_DAY = "15";

// Called by the background worker (and manually by an admin).
// One bill per active occupant for the given month; safe to re-run.
async function generateMonthlyBills(month /* 'YYYY-MM' */) {
  const occupants = await billRepo.getActiveOccupantsWithRent();
  const dueDate = `${month}-${RENT_DUE_DAY}`;
  let created = 0;
  let skipped = 0;

  for (const occ of occupants) {
    const bill = await billRepo.createBill({
      tenantId: occ.tenant_id,
      roomId: occ.room_id,
      month,
      amount: occ.rent_amount,
      dueDate,
    });
    if (bill) created++;
    else skipped++;
  }

  return { month, totalOccupants: occupants.length, created, skipped };
}

async function getMyBills(tenantId) {
  return billRepo.findByTenant(tenantId);
}

async function getOwnerBills(ownerId, filters) {
  return billRepo.findForOwner(ownerId, filters);
}

async function getBillById(billId) {
  const bill = await billRepo.findById(billId);
  if (!bill) throw new AppError("Bill not found", 404);
  return bill;
}

module.exports = { generateMonthlyBills, getMyBills, getOwnerBills, getBillById };
