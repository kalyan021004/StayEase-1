import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page center-text">
      <div className="board board-small" role="img" aria-label="Sign">
        <p className="board-word">404</p>
        <p className="board-line">This page has moved out</p>
      </div>
      <p>
        <Link to="/" className="btn btn-primary">
          Go to the home page
        </Link>
      </p>
    </div>
  );
}
