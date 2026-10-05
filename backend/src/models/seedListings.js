// Demo data for local development: one approved owner with listings across
// all three cities, plus a demo tenant who lives in a room and has a bill.
// Idempotent - safe to run repeatedly.  Usage: npm run seed:listings
// NEVER run against production.
const { pool, query } = require("../config/db");
const { hashPassword } = require("../utils/password");

const DEMO_OWNER = { name: "Lakshmi Narayanan", email: "owner@stayease.in", password: "Owner12345", phone: "9840012345" };
const DEMO_TENANT = { name: "Arjun Mehta", email: "tenant@stayease.in", password: "Tenant12345", phone: "9900011122" };

const SAMPLE_PGS = [
  { name: "Sunrise Men's PG", city: "Chennai", address: "2nd Avenue, Anna Nagar, Chennai 600040", genderType: "male",
    amenities: ["Wi-Fi", "Veg meals", "Laundry", "AC"],
    rooms: [["101", "single", 9000, 1], ["102", "double", 6500, 2], ["103", "triple", 5200, 3]] },
  { name: "Green Nest Women's PG", city: "Chennai", address: "Taramani Link Rd, Velachery, Chennai 600042", genderType: "female",
    amenities: ["Wi-Fi", "Meals", "CCTV", "Laundry", "Warden"],
    rooms: [["201", "double", 7000, 2], ["202", "triple", 5500, 3]] },
  { name: "OMR Techie Stay", city: "Chennai", address: "Thoraipakkam, OMR, Chennai 600097", genderType: "unisex",
    amenities: ["Wi-Fi", "Power backup", "Housekeeping", "Gym"],
    rooms: [["G1", "single", 11000, 1], ["G2", "double", 8000, 2]] },
  { name: "Tech Park Stay", city: "Hyderabad", address: "Near DLF Cyber City, Gachibowli, Hyderabad 500032", genderType: "unisex",
    amenities: ["Wi-Fi", "Gym", "Meals", "AC"],
    rooms: [["A1", "single", 10500, 1], ["A2", "double", 7200, 2]] },
  { name: "Budget Boys PG", city: "Hyderabad", address: "Ameerpet Main Rd, Hyderabad 500016", genderType: "male",
    amenities: ["Wi-Fi", "Meals"],
    rooms: [["B1", "triple", 4800, 3], ["B2", "double", 6000, 2]] },
  { name: "Madhapur Ladies Residency", city: "Hyderabad", address: "Ayyappa Society, Madhapur, Hyderabad 500081", genderType: "female",
    amenities: ["Wi-Fi", "Meals", "CCTV", "Hot water", "Laundry"],
    rooms: [["M1", "double", 7500, 2], ["M2", "triple", 6000, 3]] },
  { name: "Koramangala Co-Living", city: "Bangalore", address: "5th Block, Koramangala, Bengaluru 560095", genderType: "unisex",
    amenities: ["Wi-Fi", "Meals", "Gym", "Laundry", "AC"],
    rooms: [["301", "single", 12000, 1], ["302", "double", 8500, 2]] },
  { name: "Whitefield Comfort PG", city: "Bangalore", address: "ITPL Main Rd, Whitefield, Bengaluru 560066", genderType: "female",
    amenities: ["Wi-Fi", "Meals", "CCTV"],
    rooms: [["401", "double", 7800, 2], ["402", "triple", 6200, 3]] },
  { name: "HSR Layout Men's PG", city: "Bangalore", address: "Sector 2, HSR Layout, Bengaluru 560102", genderType: "male",
    amenities: ["Wi-Fi", "Meals", "Power backup", "Parking"],
    rooms: [["H1", "single", 10000, 1], ["H2", "double", 7000, 2], ["H3", "triple", 5800, 3]] },
];

async function upsertUser({ name, email, password, phone }, role) {
  const existing = await query("SELECT * FROM users WHERE email = $1", [email]);
  if (existing.rows[0]) return existing.rows[0];
  const res = await query(
    `INSERT INTO users (name, email, password_hash, phone, role, status)
     VALUES ($1, $2, $3, $4, $5, 'approved') RETURNING *`,
    [name, email, await hashPassword(password), phone, role]
  );
  console.log(`Created ${role}: ${email} / ${password}`);
  return res.rows[0];
}

async function seed() {
  const owner = await upsertUser(DEMO_OWNER, "owner");
  const tenant = await upsertUser(DEMO_TENANT, "tenant");
  let firstRoomId = null;

  for (const pgData of SAMPLE_PGS) {
    const existingPg = await query("SELECT id FROM pgs WHERE owner_id = $1 AND name = $2", [owner.id, pgData.name]);
    if (existingPg.rows[0]) {
      console.log(`Skipping existing PG: ${pgData.name}`);
      continue;
    }
    const pgRes = await query(
      `INSERT INTO pgs (owner_id, name, city, address, gender_type, amenities, photos, status)
       VALUES ($1, $2, $3, $4, $5, $6, '[]', 'approved') RETURNING id`,
      [owner.id, pgData.name, pgData.city, pgData.address, pgData.genderType, JSON.stringify(pgData.amenities)]
    );
    const pgId = pgRes.rows[0].id;
    for (const [roomNumber, sharingType, rent, capacity] of pgData.rooms) {
      const r = await query(
        `INSERT INTO rooms (pg_id, room_number, sharing_type, rent_amount, capacity, status)
         VALUES ($1, $2, $3, $4, $5, 'vacant') RETURNING id`,
        [pgId, roomNumber, sharingType, rent, capacity]
      );
      if (!firstRoomId && capacity > 1) firstRoomId = r.rows[0].id;
    }
    console.log(`Created PG: ${pgData.name} (${pgData.city}) with ${pgData.rooms.length} rooms`);
  }

  // Place the demo tenant in a shared room and give them this month's bill.
  const placed = await query("SELECT * FROM room_occupants WHERE tenant_id = $1 AND status = 'active'", [tenant.id]);
  if (!placed.rows[0] && firstRoomId) {
    await query("INSERT INTO room_occupants (room_id, tenant_id, status) VALUES ($1, $2, 'active')", [firstRoomId, tenant.id]);
    await query("UPDATE rooms SET status = 'partial' WHERE id = $1", [firstRoomId]);
    const month = new Date().toISOString().slice(0, 7);
    await query(
      `INSERT INTO bills (tenant_id, room_id, month, amount, due_date, status)
       SELECT $1, r.id, $2::varchar, r.rent_amount, ($2::varchar || '-05')::date, 'unpaid' FROM rooms r WHERE r.id = $3
       ON CONFLICT DO NOTHING`,
      [tenant.id, month, firstRoomId]
    );
    console.log(`Placed demo tenant in room ${firstRoomId} with a ${month} bill`);
  }

  console.log("\nSeeding complete.");
  await pool.end();
}

seed().catch(async (err) => {
  console.error("Seeding failed:", err);
  await pool.end();
  process.exit(1);
});
