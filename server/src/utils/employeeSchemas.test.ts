import assert from "node:assert/strict";
import test from "node:test";
import { strongPasswordSchema } from "./authSchemas.js";
import { createEmployeeSchema } from "./employeeSchemas.js";

const validEmployee = {
  employeeCode: " dev-001 ",
  firstName: "Ravi",
  lastName: "Kumar",
  email: " Ravi.Kumar@Talme.com ",
  phone: "",
  departmentId: "department-id",
  designation: "Developer",
  managerId: "",
  joiningDate: "2026-09-29",
  employmentStatus: "ACTIVE",
  roleName: "EMPLOYEE"
};

test("normalizes employee code and email", () => {
  const result = createEmployeeSchema.parse(validEmployee);
  assert.equal(result.employeeCode, "DEV-001");
  assert.equal(result.email, "ravi.kumar@talme.com");
  assert.equal(result.phone, null);
  assert.equal(result.managerId, null);
});

test("rejects SUPER_ADMIN assignment through employee creation", () => {
  const result = createEmployeeSchema.safeParse({ ...validEmployee, roleName: "SUPER_ADMIN" });
  assert.equal(result.success, false);
});

test("requires a 12 character password with a symbol", () => {
  assert.equal(strongPasswordSchema.safeParse("NoSymbolPassword123").success, false);
  assert.equal(strongPasswordSchema.safeParse("Strong!Pass123").success, true);
});
