// One place that turns any thrown error into a { error: "message" } response.
const env = require("../config/env");

// Postgres error codes that are the client's fault, not a server bug.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
function fromPostgres(err) {
  switch (err.code) {
    case "23505": // unique_violation
      if (err.constraint === "rooms_pg_id_room_number_key") {
        return { status: 409, message: "A room with this number already exists in this PG" };
      }
      if (err.constraint === "uniq_active_tenant") {
        return { status: 409, message: "This tenant already has an active room" };
      }
      if (err.constraint === "uniq_pending_booking") {
        return { status: 409, message: "You've already requested this room. The owner will respond soon." };
      }
      if (err.constraint === "users_email_key" || err.constraint === "uniq_users_email_lower") {
        return { status: 409, message: "An account with this email already exists" };
      }
      return { status: 409, message: "This record already exists" };
    case "23503": // foreign_key_violation
      return { status: 409, message: "This action conflicts with related records" };
    case "22P02": // invalid_text_representation (e.g. "abc" for an integer id)
    case "22007": // invalid_datetime_format
    case "22008": // datetime_field_overflow
      return { status: 400, message: "Invalid value in request" };
    default:
      return null;
  }
}

function errorHandler(err, req, res, next) {
  // Malformed JSON body from express.json()
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  const pgMapped = fromPostgres(err);
  const statusCode = pgMapped ? pgMapped.status : err.statusCode || 500;
  const isOperational = Boolean(pgMapped) || err.isOperational || false;
  const message = pgMapped ? pgMapped.message : err.message;

  // Full detail goes to the structured log (with request id), not to the client.
  const log = req.log || console;
  if (statusCode >= 500) log.error({ err }, "Request failed");
  else log.warn({ err: { message, code: err.code } }, "Request rejected");

  res.status(statusCode).json({
    error: isOperational ? message : "Something went wrong on our end",
    requestId: req.id,
    ...(env.nodeEnv === "development" && !isOperational ? { stack: err.stack } : {}),
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

module.exports = { errorHandler, notFound };
