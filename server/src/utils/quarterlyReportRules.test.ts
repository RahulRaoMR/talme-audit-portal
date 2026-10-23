import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOverallScore,
  calculateWeightTotal,
  calculateWeightedScore,
  canEditQuarterlyReport,
  canFinalizeQuarterlyReport,
  canManagerReviewQuarterlyReport,
  canViewQuarterlyReport,
  getQuarterMonths,
  isWeightTotalValid,
  kpiAppliesToDepartment,
  selectRating
} from "./quarterlyReportRules.js";

test("quarters map to their three calendar months", () => {
  assert.deepEqual(getQuarterMonths("Q1"), [1, 2, 3]);
  assert.deepEqual(getQuarterMonths("Q2"), [4, 5, 6]);
  assert.deepEqual(getQuarterMonths("Q3"), [7, 8, 9]);
  assert.deepEqual(getQuarterMonths("Q4"), [10, 11, 12]);
});

test("weighted and overall scores are calculated without normalizing", () => {
  assert.equal(calculateWeightedScore(80, 25), 20);
  assert.equal(calculateOverallScore([{ score: 80, weightage: 25 }, { score: 90, weightage: 75 }]), 87.5);
});

test("weight totals must equal exactly 100 within decimal tolerance", () => {
  assert.equal(calculateWeightTotal([30, 35, 35]), 100);
  assert.equal(isWeightTotalValid(100), true);
  assert.equal(isWeightTotalValid(85), false);
});

test("common KPI applies to every department and scoped KPI only to its department", () => {
  assert.equal(kpiAppliesToDepartment({ isCommon: true, departmentId: null }, "dev"), true);
  assert.equal(kpiAppliesToDepartment({ isCommon: false, departmentId: "dev" }, "dev"), true);
  assert.equal(kpiAppliesToDepartment({ isCommon: false, departmentId: "hr" }, "dev"), false);
});

test("rating selects the configured active range", () => {
  const ranges = [
    { name: "Outstanding", minScore: 90, maxScore: 100, isActive: true },
    { name: "Good", minScore: 70, maxScore: 89.99, isActive: true }
  ];
  assert.equal(selectRating(92, ranges), "Outstanding");
  assert.equal(selectRating(75, ranges), "Good");
  assert.equal(selectRating(60, ranges), null);
});

const directReport = {
  actorEmployeeId: "manager",
  roleName: "MANAGER" as const,
  ownerEmployeeId: "employee",
  ownerManagerId: "manager",
  status: "SUBMITTED" as const
};

test("manager can review a direct report but not an unrelated employee", () => {
  assert.equal(canManagerReviewQuarterlyReport(directReport), true);
  assert.equal(canManagerReviewQuarterlyReport({ ...directReport, actorEmployeeId: "other" }), false);
});

test("employee can edit only their draft or returned report", () => {
  assert.equal(canEditQuarterlyReport({ ...directReport, actorEmployeeId: "employee", status: "RETURNED" }), true);
  assert.equal(canEditQuarterlyReport({ ...directReport, actorEmployeeId: "employee", status: "FINALIZED" }), false);
});

test("auditor sees only finalized quarterly reports", () => {
  const auditor = { ...directReport, actorEmployeeId: "auditor", roleName: "AUDITOR" as const };
  assert.equal(canViewQuarterlyReport(auditor), false);
  assert.equal(canViewQuarterlyReport({ ...auditor, status: "FINALIZED" }), true);
});

test("only HR or super admin finalizes a manager-reviewed report", () => {
  assert.equal(canFinalizeQuarterlyReport({ ...directReport, roleName: "HR_ADMIN", status: "MANAGER_REVIEWED" }), true);
  assert.equal(canFinalizeQuarterlyReport({ ...directReport, status: "MANAGER_REVIEWED" }), false);
});
