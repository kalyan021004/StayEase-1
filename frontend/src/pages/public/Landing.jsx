import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchPgs } from "../../api/pgs";
import { useAsync } from "../../hooks/useAsync";
import { CITIES } from "../../lib/format";
import PgListItem from "../../components/PgListItem";
import { AsyncBlock, EmptyState } from "../../components/ui";

const FOR_OPTIONS = [
  { value: "", label: "Anyone" },
  { value: "male", label: "Men" },
  { value: "female", label: "Women" },
  { value: "unisex", label: "Co-living" },
];

const BUDGETS = [
  { value: "", label: "Any budget" },
  { value: "6000", label: "Up to ₹6,000" },
  { value: "8000", label: "Up to ₹8,000" },
  { value: "10000", label: "Up to ₹10,000" },
  { value: "15000", label: "Up to ₹15,000" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [city, setCity] = useState("Bangalore");
  const [genderType, setGenderType] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const latest = useAsync((signal) => searchPgs({ limit: 6 }, { signal }), []);

  function submit(e) {
    e.preventDefault();
    const qs = new URLSearchParams({ city });
    if (genderType) qs.set("genderType", genderType);
    if (maxRent) qs.set("maxRent", maxRent);
    navigate(`/search?${qs}`);
  }

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="board-wrap">
            <div className="board" role="img" aria-label="To-let sign">
              <span className="board-nail" aria-hidden="true" />
              <span className="board-nail" aria-hidden="true" />
              <p className="board-word">To-Let</p>
              <p className="board-line">Rooms for students and working people</p>
              <p className="board-sub">Bangalore, Hyderabad, Chennai</p>
            </div>
          </div>

          <div className="hero-copy">
            <h1>Find your PG without the broker runaround.</h1>
            <p className="lede">
              Real rent, real free beds, and the owner answers your request on the app. Pay rent online when you move in.
            </p>

            <form className="hero-search" onSubmit={submit}>
              <fieldset className="seg" aria-label="City">
                <legend className="sr-only">City</legend>
                {CITIES.map((c) => (
                  <label key={c} className={city === c ? "on" : ""}>
                    <input type="radio" name="city" value={c} checked={city === c} onChange={() => setCity(c)} />
                    {c}
                  </label>
                ))}
              </fieldset>
              <div className="hero-row">
                <label className="select-wrap">
                  <span className="sr-only">PG for</span>
                  <select value={genderType} onChange={(e) => setGenderType(e.target.value)}>
                    {FOR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value ? `For ${o.label.toLowerCase()}` : "For anyone"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="select-wrap">
                  <span className="sr-only">Budget</span>
                  <select value={maxRent} onChange={(e) => setMaxRent(e.target.value)}>
                    {BUDGETS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary btn-lg" type="submit">
                  Show PGs in {city}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Just listed</h2>
          <Link to="/search" className="link">
            See all PGs
          </Link>
        </div>
        <AsyncBlock
          state={latest}
          isEmpty={(d) => d.pgs.length === 0}
          empty={<EmptyState title="No PGs listed yet" message="Check back soon - new places are added every week." />}
        >
          {(d) => (
            <div className="pg-grid">
              {d.pgs.map((pg) => (
                <PgListItem key={pg.id} pg={pg} />
              ))}
            </div>
          )}
        </AsyncBlock>
      </section>

      <section className="section steps-section">
        <h2>How moving in works</h2>
        <ol className="steps">
          <li>
            <h3>Pick a room</h3>
            <p>Every PG shows its rooms, sharing type, rent and how many beds are free today.</p>
          </li>
          <li>
            <h3>Send a request</h3>
            <p>Choose your move-in date. No token money, no broker fee.</p>
          </li>
          <li>
            <h3>Owner confirms</h3>
            <p>You'll see it under Requests the moment the owner says yes.</p>
          </li>
          <li>
            <h3>Pay rent here</h3>
            <p>Your bill shows up on the 1st. Pay by UPI, card or netbanking.</p>
          </li>
        </ol>
      </section>

      <section className="owner-band">
        <div className="owner-band-inner">
          <div>
            <h2>Run a PG? Keep every room on one screen.</h2>
            <p>
              See which beds are free, accept requests in one tap, and download the month's rent sheet for your
              accountant. Listing is free.
            </p>
            <Link to="/signup?role=owner" className="btn btn-primary btn-lg">
              List your PG
            </Link>
          </div>
          <div className="mini-board" aria-hidden="true">
            {["101", "102", "103", "104", "201", "202", "203", "204"].map((n, i) => (
              <span key={n} className={`key key-${["occupied", "partial", "vacant", "occupied", "vacant", "occupied", "partial", "occupied"][i]}`}>
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
