import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createListing, getPg, updateListing } from "../../api/pgs";
import { CITIES } from "../../lib/format";
import { Button, ErrorState, Field, InlineError, LoadingList, PageHeader, useToast } from "../../components/ui";

const COMMON_AMENITIES = ["Wi-Fi", "Meals", "Veg meals", "AC", "Laundry", "Housekeeping", "Hot water", "Power backup", "CCTV", "Warden", "Gym", "Parking"];

const EMPTY = { name: "", city: "Bangalore", address: "", genderType: "unisex", amenities: [], extra: "", photos: "" };

export default function ListingForm() {
  const { pgId } = useParams();
  const editing = Boolean(pgId);
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loadState, setLoadState] = useState(editing ? "loading" : "ready");
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const ctrl = new AbortController();
    getPg(pgId, { signal: ctrl.signal })
      .then(({ pg }) => {
        const amen = pg.amenities || [];
        setForm({
          name: pg.name,
          city: pg.city,
          address: pg.address,
          genderType: pg.gender_type,
          amenities: amen.filter((a) => COMMON_AMENITIES.includes(a)),
          extra: amen.filter((a) => !COMMON_AMENITIES.includes(a)).join(", "),
          photos: (pg.photos || []).join("\n"),
        });
        setLoadState("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoadError(err);
        setLoadState("error");
      });
    return () => ctrl.abort();
  }, [editing, pgId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleAmenity = (a) =>
    setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }));

  function validate() {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Give your PG a name (at least 2 letters).";
    if (form.address.trim().length < 5) e.address = "Add the full address with area and pincode.";
    const photos = form.photos.split("\n").map((s) => s.trim()).filter(Boolean);
    if (photos.some((p) => !/^https?:\/\/\S+$/.test(p))) e.photos = "Each line must be a full link starting with https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setError(null);
    const amenities = [
      ...form.amenities,
      ...form.extra.split(",").map((s) => s.trim()).filter(Boolean),
    ];
    const photos = form.photos.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      if (editing) {
        await updateListing(pgId, { name: form.name.trim(), address: form.address.trim(), genderType: form.genderType, amenities, photos });
        toast("Changes saved");
        navigate("/owner/listings");
      } else {
        const { pg } = await createListing({
          name: form.name.trim(),
          city: form.city,
          address: form.address.trim(),
          genderType: form.genderType,
          amenities,
          photos,
        });
        toast("PG added. Now add its rooms.");
        navigate(`/owner/listings/${pg.id}/rooms`);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loadState === "loading") return <div className="page"><LoadingList rows={4} /></div>;
  if (loadState === "error") return <div className="page"><ErrorState error={loadError} onRetry={() => window.location.reload()} /></div>;

  return (
    <div className="page page-narrow">
      <PageHeader
        title={editing ? "Edit PG details" : "Add a PG"}
        subtitle={editing ? null : "New PGs are checked by our team before tenants can see them."}
      />
      <form className="form-card stack" onSubmit={submit} noValidate>
        <Field label="PG name" error={errors.name}>
          {(p) => <input value={form.name} onChange={set("name")} placeholder="Sri Sai Ladies PG" maxLength={160} {...p} />}
        </Field>

        <Field label="City" hint={editing ? "City can't be changed after the PG is created." : undefined}>
          {(p) => (
            <select value={form.city} onChange={set("city")} disabled={editing} {...p}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Full address" error={errors.address} hint="Street, area and pincode. Tenants use this to find you.">
          {(p) => <textarea rows={2} value={form.address} onChange={set("address")} maxLength={500} {...p} />}
        </Field>

        <fieldset className="radio-row">
          <legend>Who can stay</legend>
          {[
            ["male", "Men only"],
            ["female", "Women only"],
            ["unisex", "Anyone (co-living)"],
          ].map(([v, l]) => (
            <label key={v} className={form.genderType === v ? "on" : ""}>
              <input type="radio" name="gender" value={v} checked={form.genderType === v} onChange={set("genderType")} />
              {l}
            </label>
          ))}
        </fieldset>

        <fieldset className="check-grid">
          <legend>What's included</legend>
          {COMMON_AMENITIES.map((a) => (
            <label key={a} className={form.amenities.includes(a) ? "on" : ""}>
              <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggleAmenity(a)} />
              {a}
            </label>
          ))}
        </fieldset>
        <Field label="Anything else?" hint="Separate with commas, e.g. Fridge, TV room">
          {(p) => <input value={form.extra} onChange={set("extra")} {...p} />}
        </Field>

        <Field label="Photo links" error={errors.photos} hint="Optional. One link per line (for example from Google Photos or Drive, set to public).">
          {(p) => <textarea rows={3} value={form.photos} onChange={set("photos")} placeholder="https://..." {...p} />}
        </Field>

        <InlineError error={error} />
        <div className="row-end">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {editing ? "Save changes" : "Add PG"}
          </Button>
        </div>
      </form>
    </div>
  );
}
