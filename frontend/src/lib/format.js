const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const rupees = (n) => (n === null || n === undefined || n === "" ? "—" : inr.format(Number(n)));

export function shortDate(value) {
  if (!value) return "—";
  // Date-only strings ("2026-11-01") are calendar dates: parse as local, not UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function monthLabel(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const GENDER_LABEL = { male: "Men only", female: "Women only", unisex: "Co-living" };
export const SHARING_LABEL = { single: "Single room", double: "2 sharing", triple: "3 sharing" };
export const CITIES = ["Bangalore", "Hyderabad", "Chennai"];

export function bedsWord(n) {
  return `${n} ${n === 1 ? "bed" : "beds"}`;
}

export function locality(address) {
  // "2nd Avenue, Anna Nagar, Chennai 600040" -> "Anna Nagar"
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2];
  return parts[0];
}
