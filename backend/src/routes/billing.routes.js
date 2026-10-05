const express = require("express");
const router = express.Router();

const billingController = require("../controllers/billing.controller");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const {
  validate,
  validateQuery,
  ownerBillsQuerySchema,
  generateBillsSchema,
} = require("../middlewares/validate.middleware");

router.get("/mine", authenticate, requireRole("tenant"), billingController.getMyBills);

router.get(
  "/owner",
  authenticate,
  requireRole("owner"),
  validateQuery(ownerBillsQuerySchema),
  billingController.getOwnerBills
);
router.get(
  "/owner/export",
  authenticate,
  requireRole("owner"),
  validateQuery(ownerBillsQuerySchema),
  billingController.exportPaymentSheet
);

router.post(
  "/admin/generate",
  authenticate,
  requireRole("admin"),
  validate(generateBillsSchema),
  billingController.manualGenerate
);

module.exports = router;
