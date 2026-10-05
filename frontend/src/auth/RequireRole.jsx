import { Navigate, Outlet, useLocation } from "react-router-dom";
import { HOME_FOR_ROLE, useAuth } from "./AuthContext";
import { FullPageLoader, ErrorState } from "../components/ui";

// Route guard: <Route element={<RequireRole roles={["owner"]} />}> ... </Route>
export default function RequireRole({ roles }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "checking") return <FullPageLoader />;
  if (status === "offline") {
    return (
      <div className="page">
        <ErrorState
          title="You're offline"
          message="We couldn't check your login. Reconnect and reload the page."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_FOR_ROLE[user.role] || "/"} replace />;
  return <Outlet />;
}
