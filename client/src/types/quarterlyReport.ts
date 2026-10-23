export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type QuarterlyStatus = "DRAFT" | "SUBMITTED" | "MANAGER_REVIEWED" | "RETURNED" | "FINALIZED";
export type KpiUnitType = "NUMBER" | "PERCENTAGE" | "BOOLEAN" | "RATING" | "TEXT";

export type Kpi = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  departmentId: string | null;
  department: { id: string; name: string; code: string } | null;
  isCommon: boolean;
  unitType: KpiUnitType;
  weightage: string | number;
  isActive: boolean;
  sortOrder: number;
};

export type KpiInput = {
  name: string;
  code: string;
  description: string;
  departmentId: string;
  isCommon: boolean;
  unitType: KpiUnitType;
  weightage: number;
  sortOrder: number;
};

export type RatingRange = {
  id: string;
  name: string;
  minScore: string | number;
  maxScore: string | number;
  isActive: boolean;
  sortOrder: number;
};

export type QuarterlyEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation?: string;
  managerId: string | null;
  department: { id: string; name: string; code: string };
};

export type QuarterlyMonthlyReport = {
  id: string;
  month: number;
  year: number;
  reportPeriod: string;
  status: "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED";
  summary?: string;
};

export type QuarterlyListItem = {
  id: string;
  quarter: Quarter;
  year: number;
  status: QuarterlyStatus;
  overallScore: string | number | null;
  finalRating: string | null;
  employeeSubmittedAt: string | null;
  managerReviewedAt: string | null;
  finalizedAt: string | null;
  updatedAt: string;
  employee: QuarterlyEmployee;
  monthlyReport1: Pick<QuarterlyMonthlyReport, "id" | "status" | "month"> | null;
  monthlyReport2: Pick<QuarterlyMonthlyReport, "id" | "status" | "month"> | null;
  monthlyReport3: Pick<QuarterlyMonthlyReport, "id" | "status" | "month"> | null;
};

export type QuarterlyKpiScore = {
  id: string;
  kpiId: string;
  targetValue: string | null;
  actualValue: string | null;
  score: string | number;
  weightageSnapshot: string | number;
  weightedScore: string | number;
  managerComment: string | null;
  kpi: Kpi;
};

export type QuarterlyReport = Omit<QuarterlyListItem, "monthlyReport1" | "monthlyReport2" | "monthlyReport3"> & {
  summary: string;
  majorAchievements: string;
  majorChallenges: string;
  nextQuarterFocus: string;
  employeeComments: string | null;
  managerComments: string | null;
  hrComments: string | null;
  monthlyReports: Array<{ month: number; report: QuarterlyMonthlyReport | null }>;
  kpiScores: QuarterlyKpiScore[];
  managerReviewedBy: { id: string; email: string; employee: { firstName: string; lastName: string } | null } | null;
  hrReviewedBy: { id: string; email: string; employee: { firstName: string; lastName: string } | null } | null;
  history: Array<{ id: string; action: string; comment: string | null; createdAt: string; performedByUser: { email: string; employee: { firstName: string; lastName: string } | null } }>;
};

export type QuarterlyInput = {
  quarter: Quarter;
  year: number;
  summary: string;
  majorAchievements: string;
  majorChallenges: string;
  nextQuarterFocus: string;
  employeeComments: string;
};

export type QuarterlyFilters = {
  scope?: "mine" | "review";
  quarter?: Quarter | "";
  year?: string | number;
  status?: QuarterlyStatus | "";
  departmentId?: string;
  employeeId?: string;
  page?: number;
  pageSize?: number;
};

