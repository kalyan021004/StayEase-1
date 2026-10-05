// Build the owner's payment sheet, upload it to object storage, and return a
// 5-minute signed URL. Nothing is stored on local disk (it wouldn't survive a
// redeploy) and the bucket is never public (this is tenant financial data).
const ExcelJS = require("exceljs");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3, s3Public } = require("../config/s3");
const env = require("../config/env");
const billRepo = require("../repositories/bill.repository");
const AppError = require("../utils/AppError");

const URL_TTL_SECONDS = 300;

async function buildWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StayEase";
  const sheet = workbook.addWorksheet("Payments", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "PG", key: "pg_name", width: 24 },
    { header: "Room", key: "room_number", width: 10 },
    { header: "Tenant", key: "tenant_name", width: 22 },
    { header: "Email", key: "tenant_email", width: 28 },
    { header: "Phone", key: "tenant_phone", width: 14 },
    { header: "Month", key: "month", width: 10 },
    { header: "Amount (₹)", key: "amount", width: 12, style: { numFmt: "#,##,##0.00" } },
    { header: "Status", key: "status", width: 10 },
    { header: "Due Date", key: "due_date", width: 12 },
    { header: "Paid At", key: "paid_at", width: 20, style: { numFmt: "dd-mmm-yyyy hh:mm" } },
    { header: "Payment Ref", key: "provider_ref", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((row) => sheet.addRow(row));

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const collected = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
  sheet.addRow({});
  sheet.addRow({ tenant_email: "Total billed", amount: total }).font = { bold: true };
  sheet.addRow({ tenant_email: "Collected", amount: collected }).font = { bold: true };
  sheet.addRow({ tenant_email: "Pending", amount: total - collected }).font = { bold: true };

  return workbook;
}

// ownerId comes from the verified JWT, never from the client.
async function generateOwnerPaymentSheet(ownerId, filters) {
  const rows = await billRepo.findForOwner(ownerId, filters);
  if (rows.length === 0) throw new AppError("No bills found for this filter", 404);

  const workbook = await buildWorkbook(rows);
  const buffer = await workbook.xlsx.writeBuffer();

  const suffix = [filters.month, filters.pgId ? `pg${filters.pgId}` : null].filter(Boolean).join("-");
  const filename = `stayease-payments${suffix ? "-" + suffix : ""}.xlsx`;
  const key = `owner-exports/${ownerId}/${Date.now()}-${filename}`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
  } catch (err) {
    throw Object.assign(new AppError("Couldn't save the export file. Please try again in a minute.", 502), {
      cause: err,
    });
  }

  const url = await getSignedUrl(
    s3Public,
    new GetObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: URL_TTL_SECONDS }
  );

  return { url, rowCount: rows.length, filename, expiresInSeconds: URL_TTL_SECONDS };
}

module.exports = { generateOwnerPaymentSheet, buildWorkbook };
