const billingService = require("../services/billing.service");
const exportService = require("../services/export.service");

// GET /api/bills/mine  (tenant)
async function getMyBills(req, res, next) {
  try {
    const bills = await billingService.getMyBills(req.user.id);
    res.status(200).json({ bills });
  } catch (err) {
    next(err);
  }
}

// GET /api/bills/owner?pgId=1&month=2026-10  (owner)
async function getOwnerBills(req, res, next) {
  try {
    const bills = await billingService.getOwnerBills(req.user.id, req.query);
    res.status(200).json({ bills });
  } catch (err) {
    next(err);
  }
}

// GET /api/bills/owner/export?pgId=1&month=2026-10  (owner) - the Excel export
async function exportPaymentSheet(req, res, next) {
  try {
    const result = await exportService.generateOwnerPaymentSheet(req.user.id, req.query);
    res.status(200).json({
      message: "Export ready. Link expires in 5 minutes.",
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/bills/admin/generate  (admin, manual trigger; normally the
// scheduled worker job does this automatically on the 1st of every month)
async function manualGenerate(req, res, next) {
  try {
    const month = (req.body && req.body.month) || new Date().toISOString().slice(0, 7);
    const result = await billingService.generateMonthlyBills(month);
    res.status(200).json({ message: "Bills generated", ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyBills, getOwnerBills, exportPaymentSheet, manualGenerate };