// Admins aren't created via public signup (see auth.service.js).
// Run this once to create the first admin account.
// Usage: node src/models/seedAdmin.js admin@pgplatform.com MyStrongPass123
const { pool, query } = require("../config/db");
const { hashPassword } = require("../utils/password");

async function seed() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Usage: node src/models/seedAdmin.js <email> <password>");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'admin', 'approved')
     ON CONFLICT (email) DO NOTHING`,
    ["Super Admin", email, passwordHash]
  );

  console.log(`Admin ready: ${email}`);
  await pool.end();
}

seed();
