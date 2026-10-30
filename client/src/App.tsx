import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { EditEmployeePage } from "./pages/EditEmployeePage";
import { EmployeeDetailsPage } from "./pages/EmployeeDetailsPage";
import { EmployeeListPage } from "./pages/EmployeeListPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { NewEmployeePage } from "./pages/NewEmployeePage";
import { MonthlyReportDetailsPage } from "./pages/MonthlyReportDetailsPage";
import { MonthlyReportEditorPage } from "./pages/MonthlyReportEditorPage";
import { MonthlyReportListPage } from "./pages/MonthlyReportListPage";
import { QuarterlyReportDetailsPage } from "./pages/QuarterlyReportDetailsPage";
import { QuarterlyReportEditorPage } from "./pages/QuarterlyReportEditorPage";
import { QuarterlyReportListPage } from "./pages/QuarterlyReportListPage";
import { KpiFormPage } from "./pages/KpiFormPage";
import { KpiListPage } from "./pages/KpiListPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { VerifyOtpPage } from "./pages/VerifyOtpPage";
import { EmployeeAdminRoute } from "./routes/EmployeeAdminRoute";
import { PasswordChangedRoute } from "./routes/PasswordChangedRoute";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { MonthlyReportReviewerRoute } from "./routes/MonthlyReportReviewerRoute";
import { AuditListPage } from "./pages/AuditListPage";
import { AuditEditorPage } from "./pages/AuditEditorPage";
import { AuditDetailsPage } from "./pages/AuditDetailsPage";
import { CapaRegisterPage } from "./pages/CapaRegisterPage";
import { FindingDetailsPage } from "./pages/FindingDetailsPage";
import { ComplianceDocumentsPage } from "./pages/ComplianceDocumentsPage";
import { AuditReportsPage } from "./pages/AuditReportsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { RiskRegisterPage } from "./pages/RiskRegisterPage";
import { RiskEditorPage } from "./pages/RiskEditorPage";
import { RiskDetailPage } from "./pages/RiskDetailPage";
import { RiskConfigurationPage } from "./pages/RiskConfigurationPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<PasswordChangedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/audits" element={<AuditListPage />} />
            <Route path="/audits/new" element={<AuditEditorPage />} />
            <Route path="/audits/:id" element={<AuditDetailsPage />} />
            <Route path="/audits/:id/edit" element={<AuditEditorPage />} />
            <Route path="/capas" element={<CapaRegisterPage />} />
            <Route path="/findings/:id" element={<FindingDetailsPage />} />
            <Route path="/compliance-documents" element={<ComplianceDocumentsPage />} />
            <Route path="/audit-reports" element={<AuditReportsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/risks" element={<RiskRegisterPage />} />
            <Route path="/risks/new" element={<RiskEditorPage />} />
            <Route path="/risks/configuration" element={<RiskConfigurationPage />} />
            <Route path="/risks/:id" element={<RiskDetailPage />} />
            <Route path="/risks/:id/edit" element={<RiskEditorPage />} />
            <Route path="/monthly-reports" element={<MonthlyReportListPage />} />
            <Route path="/monthly-reports/new" element={<MonthlyReportEditorPage />} />
            <Route path="/monthly-reports/:id" element={<MonthlyReportDetailsPage />} />
            <Route path="/monthly-reports/:id/edit" element={<MonthlyReportEditorPage />} />
            <Route element={<MonthlyReportReviewerRoute />}>
              <Route path="/monthly-reports/review" element={<MonthlyReportListPage scope="review" />} />
            </Route>
            <Route path="/quarterly-reports" element={<QuarterlyReportListPage />} />
            <Route path="/quarterly-reports/new" element={<QuarterlyReportEditorPage />} />
            <Route path="/quarterly-reports/:id" element={<QuarterlyReportDetailsPage />} />
            <Route path="/quarterly-reports/:id/edit" element={<QuarterlyReportEditorPage />} />
            <Route element={<MonthlyReportReviewerRoute />}>
              <Route path="/quarterly-reports/review" element={<QuarterlyReportListPage scope="review" />} />
            </Route>
            <Route element={<EmployeeAdminRoute />}>
              <Route path="/employees" element={<EmployeeListPage />} />
              <Route path="/employees/new" element={<NewEmployeePage />} />
              <Route path="/employees/:id" element={<EmployeeDetailsPage />} />
              <Route path="/employees/:id/edit" element={<EditEmployeePage />} />
              <Route path="/kpis" element={<KpiListPage />} />
              <Route path="/kpis/new" element={<KpiFormPage />} />
              <Route path="/kpis/:id/edit" element={<KpiFormPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
