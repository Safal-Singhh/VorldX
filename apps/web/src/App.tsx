import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { AdminShell } from "./components/shell";
import { HrShell } from "./components/hrShell";
import { PublicPortal } from "./pages/Public";
import { CompanySignup } from "./pages/CompanySignup";
import { Forgot, Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { AdminHR } from "./pages/admin/HR";
import { AdminAttendance } from "./pages/admin/Attendance";
import { AdminWfh } from "./pages/admin/WfhRequests";
import { AdminLeave } from "./pages/admin/Leave";
import { AdminPolicies } from "./pages/admin/Policies";
import { AdminQr } from "./pages/admin/QrDisplays";
import { AdminFeedback } from "./pages/admin/Feedback";
import { AdminProfile } from "./pages/admin/Profile";
import { HrDashboard } from "./pages/hr/Dashboard";
import { HrEmployees } from "./pages/hr/Employees";
import { HrAttendance } from "./pages/hr/Attendance";
import { HrWfh } from "./pages/hr/WfhRequests";
import { HrLeave } from "./pages/hr/Leave";
import { HrMyLeave } from "./pages/hr/MyLeave";
import { HrMyWfh } from "./pages/hr/MyWfh";
import { HrPolicies } from "./pages/hr/Policies";
import { HrQrAttendance } from "./pages/hr/QrAttendance";
import { HrWfhAttendance } from "./pages/hr/WfhAttendance";
import { HrMyAttendance } from "./pages/hr/MyAttendance";
import { HrFeedback } from "./pages/hr/Feedback";
import { HrMyFeedback } from "./pages/hr/MyFeedback";
import { HrProfile } from "./pages/hr/Profile";
import { QrDisplay } from "./pages/Display";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading, role } = useAuth();
  if (loading) return <div className="p-8 text-sm">Loading…</div>;
  if (role !== "admin") return <Navigate to="/login" replace />;
  return <AdminShell>{children}</AdminShell>;
}

function RequireHr({ children }: { children: React.ReactNode }) {
  const { loading, role } = useAuth();
  if (loading) return <div className="p-8 text-sm">Loading…</div>;
  if (role !== "hr" && role !== "admin") return <Navigate to="/login" replace />;
  return <HrShell>{children}</HrShell>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicPortal />} />
          <Route path="/company/signup" element={<CompanySignup />} />
          <Route path="/company/login" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<Forgot />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/hr" element={<RequireAdmin><AdminHR /></RequireAdmin>} />
          <Route path="/admin/attendance" element={<RequireAdmin><AdminAttendance /></RequireAdmin>} />
          <Route path="/admin/wfh-requests" element={<RequireAdmin><AdminWfh /></RequireAdmin>} />
          <Route path="/admin/leave-requests" element={<RequireAdmin><AdminLeave /></RequireAdmin>} />
          <Route path="/admin/policies" element={<RequireAdmin><AdminPolicies /></RequireAdmin>} />
          <Route path="/admin/qr-displays" element={<RequireAdmin><AdminQr /></RequireAdmin>} />
          <Route path="/admin/feedback" element={<RequireAdmin><AdminFeedback /></RequireAdmin>} />
          <Route path="/admin/profile" element={<RequireAdmin><AdminProfile /></RequireAdmin>} />
          <Route path="/hr/dashboard" element={<RequireHr><HrDashboard /></RequireHr>} />
          <Route path="/hr/employees" element={<RequireHr><HrEmployees /></RequireHr>} />
          <Route path="/hr/attendance" element={<RequireHr><HrAttendance /></RequireHr>} />
          <Route path="/hr/wfh-requests" element={<RequireHr><HrWfh /></RequireHr>} />
          <Route path="/hr/leave-requests" element={<RequireHr><HrLeave /></RequireHr>} />
          <Route path="/hr/my-leave-requests" element={<RequireHr><HrMyLeave /></RequireHr>} />
          <Route path="/hr/my-wfh-requests" element={<RequireHr><HrMyWfh /></RequireHr>} />
          <Route path="/hr/policies" element={<RequireHr><HrPolicies /></RequireHr>} />
          <Route path="/hr/mark-attendance" element={<Navigate to="/hr/qr-attendance" replace />} />
          <Route path="/hr/qr-attendance" element={<RequireHr><HrQrAttendance /></RequireHr>} />
          <Route path="/hr/wfh-attendance" element={<RequireHr><HrWfhAttendance /></RequireHr>} />
          <Route path="/hr/my-attendance" element={<RequireHr><HrMyAttendance /></RequireHr>} />
          <Route path="/hr/feedback" element={<RequireHr><HrFeedback /></RequireHr>} />
          <Route path="/hr/my-feedback" element={<RequireHr><HrMyFeedback /></RequireHr>} />
          <Route path="/hr/profile" element={<RequireHr><HrProfile /></RequireHr>} />
          <Route path="/display/:displayId" element={<QrDisplay />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
