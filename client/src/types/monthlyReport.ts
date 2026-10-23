export type MonthlyReportStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED";
export type MonthlyReportAction =
  | "CREATED"
  | "UPDATED"
  | "SUBMITTED"
  | "RETURNED"
  | "RESUBMITTED"
  | "APPROVED"
  | "ATTACHMENT_ADDED"
  | "ATTACHMENT_REMOVED";

export type ReportEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation?: string;
  managerId: string | null;
  department: { id: string; name: string; code: string };
};

export type MonthlyReportListItem = {
  id: string;
  month: number;
  year: number;
  reportPeriod: string;
  status: MonthlyReportStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: ReportEmployee;
  _count: { attachments: number };
};

export type HrReportDetail = {
  openPositions: number;
  positionsClosed: number;
  candidatesInterviewed: number;
  employeesOnboarded: number;
  documentsCompleted: number;
  documentsPending: number;
  employeeIssuesResolved: number;
  remarks: string | null;
};

export type DeveloperReportDetail = {
  tasksAssigned: number;
  tasksCompleted: number;
  tasksPending: number;
  bugsAssigned: number;
  bugsResolved: number;
  projectsWorkedOn: number;
  deploymentsCompleted: number;
  onTimeDeliveryPercent: number | null;
  remarks: string | null;
};

export type PayrollReportDetail = {
  employeesProcessed: number;
  payrollCompleted: number;
  payrollErrors: number;
  correctionsRequired: number;
  payslipsGenerated: number;
  payslipsPending: number;
  employeeQueries: number;
  queriesResolved: number;
  pfStatus: string;
  esiStatus: string;
  tdsStatus: string;
  remarks: string | null;
};

export type MonthlyReportAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedById: string;
};

export type MonthlyReportHistory = {
  id: string;
  action: MonthlyReportAction;
  comment: string | null;
  createdAt: string;
  performedByUser: {
    id: string;
    email: string;
    employee: { firstName: string; lastName: string } | null;
  };
};

export type MonthlyReport = MonthlyReportListItem & {
  summary: string;
  achievements: string;
  challenges: string;
  pendingWork: string;
  nextMonthPlan: string;
  employeeComments: string | null;
  managerComments: string | null;
  reviewedBy: {
    id: string;
    email: string;
    employee: { firstName: string; lastName: string } | null;
  } | null;
  hrDetail: HrReportDetail | null;
  developerDetail: DeveloperReportDetail | null;
  payrollDetail: PayrollReportDetail | null;
  attachments: MonthlyReportAttachment[];
  history: MonthlyReportHistory[];
};

export type MonthlyReportInput = {
  month: number;
  year: number;
  summary: string;
  achievements: string;
  challenges: string;
  pendingWork: string;
  nextMonthPlan: string;
  employeeComments: string;
  departmentDetail: Record<string, string | number | null>;
};

export type MonthlyReportFilters = {
  scope?: "mine" | "review";
  page?: number;
  pageSize?: number;
  month?: number | string;
  year?: number | string;
  departmentId?: string;
  employeeId?: string;
  status?: MonthlyReportStatus | "";
};

export type MonthlyReportListResponse = {
  reports: MonthlyReportListItem[];
  departments: Array<{ id: string; name: string; code: string }>;
  employees: Array<{ id: string; employeeCode: string; firstName: string; lastName: string }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
