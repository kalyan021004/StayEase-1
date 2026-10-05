// Never trust the request. Validate body / query / params before the service layer.
const { z } = require("zod");

const CITIES = ["Chennai", "Hyderabad", "Bangalore"];
const GENDER_TYPES = ["male", "female", "unisex"];
const SHARING_TYPES = ["single", "double", "triple"];

function formatIssues(error) {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}

function makeValidator(source) {
  return (schema) => (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({ error: formatIssues(result.error) });
    }
    // Express 4 lets us replace req.query/req.params; use the parsed values downstream.
    req[source] = result.data;
    next();
  };
}

const validate = makeValidator("body");
const validateQuery = makeValidator("query");
const validateParams = makeValidator("params");

// Accept camelCase OR snake_case keys on PATCH bodies (older clients sent
// snake_case), and normalise to the snake_case column names repositories use.
function renameKeys(map) {
  return (input) => {
    if (!input || typeof input !== "object") return input;
    const out = { ...input };
    for (const [camel, snake] of Object.entries(map)) {
      if (out[camel] !== undefined && out[snake] === undefined) out[snake] = out[camel];
      delete out[camel];
    }
    return out;
  };
}

const id = z.coerce.number().int().positive();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format");
const isoDate = z.string().date("Date must be in YYYY-MM-DD format");

// ---------- Params ----------
const idParam = z.object({ id });
const pgIdParam = z.object({ pgId: id });
const roomIdParam = z.object({ roomId: id });
const billIdParam = z.object({ billId: id });
const occupantParams = z.object({ roomId: id, occupantId: id });

// ---------- Auth ----------
const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional(),
  role: z.enum(["owner", "tenant"], { message: "Role must be 'owner' or 'tenant'" }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").max(128),
});

// ---------- PG listings ----------
const amenities = z.array(z.string().trim().min(1).max(40)).max(30);
const photos = z.array(z.string().url().max(500)).max(12);

const createPgSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.enum(CITIES, { message: `City must be one of: ${CITIES.join(", ")}` }),
  address: z.string().trim().min(5).max(500),
  genderType: z.enum(GENDER_TYPES),
  amenities: amenities.optional(),
  photos: photos.optional(),
});

const updatePgSchema = z.preprocess(
  renameKeys({ genderType: "gender_type" }),
  z
    .object({
      name: z.string().trim().min(2).max(160).optional(),
      address: z.string().trim().min(5).max(500).optional(),
      gender_type: z.enum(GENDER_TYPES).optional(),
      amenities: amenities.optional(),
      photos: photos.optional(),
    })
    .strict()
);

const searchQuerySchema = z
  .object({
    city: z.enum(CITIES).optional(),
    genderType: z.enum(GENDER_TYPES).optional(),
    minRent: z.coerce.number().positive().optional(),
    maxRent: z.coerce.number().positive().optional(),
    page: z.coerce.number().int().positive().max(1000).optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .refine((q) => !(q.minRent && q.maxRent) || q.minRent <= q.maxRent, {
    message: "minRent cannot be greater than maxRent",
  });

// ---------- Rooms ----------
const createRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20),
  sharingType: z.enum(SHARING_TYPES),
  rentAmount: z.coerce.number().positive().max(1_000_000),
  capacity: z.coerce.number().int().positive().max(10),
});

const updateRoomSchema = z.preprocess(
  renameKeys({
    roomNumber: "room_number",
    sharingType: "sharing_type",
    rentAmount: "rent_amount",
  }),
  z
    .object({
      room_number: z.string().trim().min(1).max(20).optional(),
      sharing_type: z.enum(SHARING_TYPES).optional(),
      rent_amount: z.coerce.number().positive().max(1_000_000).optional(),
      capacity: z.coerce.number().int().positive().max(10).optional(),
    })
    .strict()
);

const assignTenantSchema = z.object({
  tenantEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
  moveInDate: isoDate.optional(),
});

// ---------- Bookings ----------
const requestBookingSchema = z.object({
  roomId: id,
  moveInDate: isoDate.optional(),
});

// ---------- Bills ----------
const ownerBillsQuerySchema = z.object({
  pgId: id.optional(),
  month: month.optional(),
});

const generateBillsSchema = z.object({
  month: month.optional(),
});

module.exports = {
  validate,
  validateQuery,
  validateParams,
  idParam,
  pgIdParam,
  roomIdParam,
  billIdParam,
  occupantParams,
  signupSchema,
  loginSchema,
  createPgSchema,
  updatePgSchema,
  searchQuerySchema,
  createRoomSchema,
  updateRoomSchema,
  assignTenantSchema,
  requestBookingSchema,
  ownerBillsQuerySchema,
  generateBillsSchema,
  CITIES,
};
