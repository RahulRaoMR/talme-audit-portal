import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const departments = [
  {
    name: "HR",
    code: "HR",
    description: "Human resources and employee operations"
  },
  {
    name: "Developers",
    code: "DEV",
    description: "Software engineering and technical delivery"
  },
  {
    name: "Payroll",
    code: "PAY",
    description: "Payroll processing and compensation operations"
  }
];

const roles = [
  {
    name: "EMPLOYEE",
    description: "Standard employee portal access"
  },
  {
    name: "MANAGER",
    description: "Manager review access"
  },
  {
    name: "HR_ADMIN",
    description: "HR administration access"
  },
  {
    name: "AUDITOR",
    description: "Internal audit review access"
  },
  {
    name: "SUPER_ADMIN",
    description: "Full administrative access"
  }
];

const kpis = [
  { name: "Monthly Report Completion", code: "COMMON_REPORT_COMPLETION", departmentCode: null, unitType: "PERCENTAGE", weightage: 10, sortOrder: 10 },
  { name: "Documentation", code: "COMMON_DOCUMENTATION", departmentCode: null, unitType: "RATING", weightage: 10, sortOrder: 20 },
  { name: "Manager Review", code: "COMMON_MANAGER_REVIEW", departmentCode: null, unitType: "RATING", weightage: 10, sortOrder: 30 },
  { name: "Recruitment Closures", code: "HR_RECRUITMENT_CLOSURES", departmentCode: "HR", unitType: "NUMBER", weightage: 14, sortOrder: 110 },
  { name: "Candidate Processing", code: "HR_CANDIDATE_PROCESSING", departmentCode: "HR", unitType: "NUMBER", weightage: 14, sortOrder: 120 },
  { name: "Employee Onboarding", code: "HR_EMPLOYEE_ONBOARDING", departmentCode: "HR", unitType: "NUMBER", weightage: 14, sortOrder: 130 },
  { name: "Documentation Completion", code: "HR_DOCUMENTATION_COMPLETION", departmentCode: "HR", unitType: "PERCENTAGE", weightage: 14, sortOrder: 140 },
  { name: "Employee Issue Resolution", code: "HR_ISSUE_RESOLUTION", departmentCode: "HR", unitType: "NUMBER", weightage: 14, sortOrder: 150 },
  { name: "Task Completion", code: "DEV_TASK_COMPLETION", departmentCode: "DEV", unitType: "PERCENTAGE", weightage: 14, sortOrder: 210 },
  { name: "On-Time Delivery", code: "DEV_ON_TIME_DELIVERY", departmentCode: "DEV", unitType: "PERCENTAGE", weightage: 14, sortOrder: 220 },
  { name: "Bug Resolution", code: "DEV_BUG_RESOLUTION", departmentCode: "DEV", unitType: "PERCENTAGE", weightage: 14, sortOrder: 230 },
  { name: "Project Contribution", code: "DEV_PROJECT_CONTRIBUTION", departmentCode: "DEV", unitType: "NUMBER", weightage: 14, sortOrder: 240 },
  { name: "Technical Documentation", code: "DEV_TECHNICAL_DOCUMENTATION", departmentCode: "DEV", unitType: "RATING", weightage: 14, sortOrder: 250 },
  { name: "Payroll Accuracy", code: "PAY_PAYROLL_ACCURACY", departmentCode: "PAY", unitType: "PERCENTAGE", weightage: 14, sortOrder: 310 },
  { name: "On-Time Payroll Processing", code: "PAY_ON_TIME_PROCESSING", departmentCode: "PAY", unitType: "RATING", weightage: 14, sortOrder: 320 },
  { name: "Payslip Completion", code: "PAY_PAYSLIP_COMPLETION", departmentCode: "PAY", unitType: "PERCENTAGE", weightage: 14, sortOrder: 330 },
  { name: "Employee Query Resolution", code: "PAY_QUERY_RESOLUTION", departmentCode: "PAY", unitType: "PERCENTAGE", weightage: 14, sortOrder: 340 },
  { name: "Compliance Completion", code: "PAY_COMPLIANCE_COMPLETION", departmentCode: "PAY", unitType: "PERCENTAGE", weightage: 14, sortOrder: 350 }
] as const;

const ratingRanges = [
  { name: "Outstanding", minScore: 90, maxScore: 100, sortOrder: 10 },
  { name: "Very Good", minScore: 80, maxScore: 89.99, sortOrder: 20 },
  { name: "Good", minScore: 70, maxScore: 79.99, sortOrder: 30 },
  { name: "Needs Improvement", minScore: 60, maxScore: 69.99, sortOrder: 40 },
  { name: "Unsatisfactory", minScore: 0, maxScore: 59.99, sortOrder: 50 }
];

async function main() {
  for (const department of departments) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: department,
      create: department
    });
  }

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role
    });
  }

  const seededDepartments = await prisma.department.findMany({
    select: { id: true, code: true }
  });
  const departmentByCode = new Map(seededDepartments.map((department) => [department.code, department.id]));

  for (const kpi of kpis) {
    const departmentId = kpi.departmentCode ? departmentByCode.get(kpi.departmentCode) : null;
    if (kpi.departmentCode && !departmentId) {
      throw new Error(`Department ${kpi.departmentCode} is required before KPI seeding`);
    }
    const data = {
      name: kpi.name,
      code: kpi.code,
      departmentId,
      isCommon: kpi.departmentCode === null,
      unitType: kpi.unitType,
      weightage: kpi.weightage,
      isActive: true,
      sortOrder: kpi.sortOrder
    };
    await prisma.kpi.upsert({ where: { code: kpi.code }, update: {}, create: data });
  }

  for (const range of ratingRanges) {
    await prisma.performanceRatingRange.upsert({
      where: { name: range.name },
      update: {},
      create: { ...range, isActive: true }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
