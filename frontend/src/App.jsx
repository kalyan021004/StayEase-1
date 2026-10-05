import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireRole from "./auth/RequireRole";
import Layout from "./components/Layout";
import { ToastProvider } from "./components/ui";
import ScrollToTop from "./components/ScrollToTop";

import Landing from "./pages/public/Landing";
import Search from "./pages/public/Search";
import PgDetail from "./pages/public/PgDetail";
import NotFound from "./pages/public/NotFound";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";

import TenantHome from "./pages/tenant/TenantHome";
import MyBookings from "./pages/tenant/MyBookings";
import MyBills from "./pages/tenant/MyBills";

import OwnerHome from "./pages/owner/OwnerHome";
import Listings from "./pages/owner/Listings";
import ListingForm from "./pages/owner/ListingForm";
import RoomBoard from "./pages/owner/RoomBoard";
import Requests from "./pages/owner/Requests";
import OwnerBills from "./pages/owner/OwnerBills";

import AdminHome from "./pages/admin/AdminHome";
import OwnerApprovals from "./pages/admin/OwnerApprovals";
import ListingApprovals from "./pages/admin/ListingApprovals";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<Layout />}>
              {/* Public */}
              <Route index element={<Landing />} />
              <Route path="search" element={<Search />} />
              <Route path="pg/:id" element={<PgDetail />} />
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />

              {/* Tenant */}
              <Route element={<RequireRole roles={["tenant"]} />}>
                <Route path="tenant" element={<TenantHome />} />
                <Route path="tenant/bookings" element={<MyBookings />} />
                <Route path="tenant/bills" element={<MyBills />} />
              </Route>

              {/* Owner */}
              <Route element={<RequireRole roles={["owner"]} />}>
                <Route path="owner" element={<OwnerHome />} />
                <Route path="owner/listings" element={<Listings />} />
                <Route path="owner/listings/new" element={<ListingForm />} />
                <Route path="owner/listings/:pgId/edit" element={<ListingForm />} />
                <Route path="owner/listings/:pgId/rooms" element={<RoomBoard />} />
                <Route path="owner/requests" element={<Requests />} />
                <Route path="owner/bills" element={<OwnerBills />} />
              </Route>

              {/* Admin */}
              <Route element={<RequireRole roles={["admin"]} />}>
                <Route path="admin" element={<AdminHome />} />
                <Route path="admin/owners" element={<OwnerApprovals />} />
                <Route path="admin/listings" element={<ListingApprovals />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
