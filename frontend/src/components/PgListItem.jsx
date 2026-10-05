import { Link } from "react-router-dom";
import { GENDER_LABEL, locality, rupees } from "../lib/format";

export default function PgListItem({ pg }) {
  const spaces = Number(pg.rooms_with_space ?? pg.vacant_rooms ?? 0);
  const amenities = (pg.amenities || []).slice(0, 4);
  const photo = (pg.photos || [])[0];

  return (
    <Link to={`/pg/${pg.id}`} className="pg-item">
      <div className={`pg-plate gender-${pg.gender_type}`}>
        {photo ? (
          <img src={photo} alt="" loading="lazy" />
        ) : (
          <span className="pg-plate-initial" aria-hidden="true">
            {pg.name.slice(0, 1)}
          </span>
        )}
        {spaces > 0 ? (
          <span className="tolet-tag">To-let</span>
        ) : (
          <span className="full-tag">Full</span>
        )}
      </div>
      <div className="pg-body">
        <h3>{pg.name}</h3>
        <p className="pg-where">
          {locality(pg.address)}, {pg.city}
        </p>
        <p className="pg-meta">
          <span className={`gender gender-${pg.gender_type}`}>{GENDER_LABEL[pg.gender_type]}</span>
          {spaces > 0 && (
            <span className="space">
              {spaces} {spaces === 1 ? "room" : "rooms"} with space
            </span>
          )}
        </p>
        {amenities.length > 0 && <p className="pg-amen">{amenities.join(", ")}</p>}
      </div>
      <div className="pg-rent">
        {pg.min_rent ? (
          <>
            <small>from</small>
            <strong>{rupees(pg.min_rent)}</strong>
            <small>a month</small>
          </>
        ) : (
          <small>Rooms coming soon</small>
        )}
      </div>
    </Link>
  );
}
