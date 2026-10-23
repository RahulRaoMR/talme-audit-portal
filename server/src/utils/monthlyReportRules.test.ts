import assert from "node:assert/strict";
import test from "node:test";
import { createMonthlyReportSchema, monthlyReportReturnSchema } from "./monthlyReportSchemas.js";
import {
  canEditMonthlyReport,
  canReviewMonthlyReport,
  canViewMonthlyReport,
  nextSubmitAction
} from "./monthlyReportRules.js";

const report = {
  actorEmployeeId: "manager-1",
  roleName: "MANAGER" as const,
  ownerEmployeeId: "employee-1",
  ownerManagerId: "manager-1",
  status: "SUBMITTED" as const
};

test("direct manager can view and review a submitted report", () => {
  assert.equal(canViewMonthlyReport(report), true);
  assert.equal(canReviewMonthlyReport(report), true);
});

test("an employee cannot review their own report", () => {
  assert.equal(canReviewMonthlyReport({ ...report, actorEmployeeId: "employee-1" }), false);
});

test("an unrelated manager cannot view or review another manager's report", () => {
  const unrelated = { ...report, actorEmployeeId: "manager-2" };
  assert.equal(canViewMonthlyReport(unrelated), false);
  assert.equal(canReviewMonthlyReport(unrelated), false);
});

test("auditor access is read-only and limited to submitted or approved reports", () => {
  const auditor = { ...report, actorEmployeeId: "auditor-1", roleName: "AUDITOR" as const };
  assert.equal(canViewMonthlyReport(auditor), true);
  assert.equal(canReviewMonthlyReport(auditor), false);
  assert.equal(canViewMonthlyReport({ ...auditor, status: "DRAFT" }), false);
  assert.equal(canEditMonthlyReport(auditor), false);
});

test("only owners can edit draft or returned reports", () => {
  assert.equal(
    canEditMonthlyReport({ ...report, actorEmployeeId: "employee-1", status: "RETURNED" }),
    true
  );
  assert.equal(
    canEditMonthlyReport({ ...report, actorEmployeeId: "employee-1", status: "APPROVED" }),
    false
  );
});

test("submission action distinguishes first submission and resubmission", () => {
  assert.equal(nextSubmitAction("DRAFT"), "SUBMITTED");
  assert.equal(nextSubmitAction("RETURNED"), "RESUBMITTED");
  assert.equal(nextSubmitAction("APPROVED"), null);
});

test("monthly report input rejects invalid month and negative metrics", () => {
  assert.equal(createMonthlyReportSchema.safeParse({ month: 13, year: new Date().getFullYear() }).success, false);
  assert.equal(
    createMonthlyReportSchema.safeParse({
      month: 9,
      year: new Date().getFullYear(),
      departmentDetail: { tasksCompleted: -1 }
    }).success,
    false
  );
});

test("returning a report requires a comment", () => {
  assert.equal(monthlyReportReturnSchema.safeParse({ comment: "" }).success, false);
  assert.equal(monthlyReportReturnSchema.safeParse({ comment: "Please add the missing totals." }).success, true);
});
