import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import type { CreateKpiInput, RatingRangeInput, UpdateKpiInput } from "../utils/quarterlyReportSchemas.js";
import { calculateWeightTotal, isWeightTotalValid } from "../utils/quarterlyReportRules.js";
import { HttpError } from "../utils/httpError.js";

const kpiInclude = { department: { select: { id: true, name: true, code: true } } } satisfies Prisma.KpiInclude;

export async function listKpis() {
  const [kpis, departments] = await Promise.all([
    prisma.kpi.findMany({ include: kpiInclude, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } })
  ]);
  const activeCommonWeight = kpis.filter((kpi) => kpi.isActive && kpi.isCommon).reduce((total, kpi) => total + Number(kpi.weightage), 0);
  const weightTotals = departments.map((department) => {
    const departmentWeight = kpis.filter((kpi) => kpi.isActive && kpi.departmentId === department.id).reduce((total, kpi) => total + Number(kpi.weightage), 0);
    const total = calculateWeightTotal([activeCommonWeight, departmentWeight]);
    return { department, total, isValid: isWeightTotalValid(total) };
  });
  return { kpis, departments, weightTotals };
}

export async function getKpi(id: string) {
  const kpi = await prisma.kpi.findUnique({ where: { id }, include: kpiInclude });
  if (!kpi) throw new HttpError(404, "KPI not found");
  return kpi;
}

async function validateKpiScope(input: Pick<CreateKpiInput, "isCommon" | "departmentId">) {
  if (!input.isCommon && input.departmentId) {
    const department = await prisma.department.findFirst({ where: { id: input.departmentId, isActive: true }, select: { id: true } });
    if (!department) throw new HttpError(400, "Selected department does not exist or is inactive");
  }
}

export async function createKpi(input: CreateKpiInput) {
  await validateKpiScope(input);
  return prisma.kpi.create({ data: input, include: kpiInclude });
}

export async function updateKpi(id: string, input: UpdateKpiInput) {
  const current = await getKpi(id);
  const scope = {
    isCommon: input.isCommon ?? current.isCommon,
    departmentId: input.departmentId === undefined ? current.departmentId : input.departmentId
  };
  await validateKpiScope(scope);
  return prisma.kpi.update({ where: { id }, data: input, include: kpiInclude });
}

export async function updateKpiStatus(id: string, isActive: boolean) {
  await getKpi(id);
  return prisma.kpi.update({ where: { id }, data: { isActive }, include: kpiInclude });
}

export async function getDepartmentKpis(departmentId: string) {
  return prisma.kpi.findMany({
    where: { isActive: true, OR: [{ isCommon: true }, { departmentId }] },
    include: kpiInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export function listRatingRanges() {
  return prisma.performanceRatingRange.findMany({ orderBy: [{ sortOrder: "asc" }, { minScore: "desc" }] });
}

async function validateRatingOverlap(input: RatingRangeInput, excludedId?: string) {
  if (!input.isActive) return;
  const overlapping = await prisma.performanceRatingRange.findFirst({
    where: {
      ...(excludedId ? { id: { not: excludedId } } : {}),
      isActive: true,
      minScore: { lte: input.maxScore },
      maxScore: { gte: input.minScore }
    },
    select: { name: true }
  });
  if (overlapping) throw new HttpError(409, `This score range overlaps with ${overlapping.name}`);
}

export async function createRatingRange(input: RatingRangeInput) {
  await validateRatingOverlap(input);
  return prisma.performanceRatingRange.create({ data: input });
}

export async function updateRatingRange(id: string, input: RatingRangeInput) {
  const existing = await prisma.performanceRatingRange.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Performance rating range not found");
  await validateRatingOverlap(input, id);
  return prisma.performanceRatingRange.update({ where: { id }, data: input });
}

