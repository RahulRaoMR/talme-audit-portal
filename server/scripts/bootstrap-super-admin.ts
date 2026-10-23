import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const bootstrapAccount = {
  email: "admin@talme.com",
  employeeCode: "ADMIN001",
  firstName: "TALME",
  lastName: "Administrator",
  designation: "Super Administrator"
};

async function main() {
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: { name: "SUPER_ADMIN" } },
    select: { email: true }
  });

  if (existingSuperAdmin) {
    console.log(`A SUPER_ADMIN already exists: ${existingSuperAdmin.email}`);
    console.log("No account or password was changed.");
    return;
  }

  const [role, department, duplicateUser, duplicateEmployee] = await Promise.all([
    prisma.role.findUnique({ where: { name: "SUPER_ADMIN" } }),
    prisma.department.findUnique({ where: { code: "HR" } }),
    prisma.user.findUnique({ where: { email: bootstrapAccount.email } }),
    prisma.employee.findFirst({
      where: {
        OR: [
          { email: bootstrapAccount.email },
          { employeeCode: bootstrapAccount.employeeCode }
        ]
      }
    })
  ]);

  if (!role || !department) {
    throw new Error("Required SUPER_ADMIN role or HR department is missing. Run the seed first.");
  }

  if (duplicateUser || duplicateEmployee) {
    throw new Error("The bootstrap email or employee code is already in use. No changes were made.");
  }

  const temporaryPassword = `Ta1!${randomBytes(16).toString("base64url")}`;
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await prisma.$transaction(async (transaction) => {
    const employee = await transaction.employee.create({
      data: {
        employeeCode: bootstrapAccount.employeeCode,
        firstName: bootstrapAccount.firstName,
        lastName: bootstrapAccount.lastName,
        email: bootstrapAccount.email,
        departmentId: department.id,
        designation: bootstrapAccount.designation,
        joiningDate: new Date(),
        employmentStatus: "ACTIVE"
      }
    });

    await transaction.user.create({
      data: {
        email: bootstrapAccount.email,
        passwordHash,
        roleId: role.id,
        employeeId: employee.id
      }
    });
  });

  console.log("SUPER_ADMIN created successfully.");
  console.log(`Email: ${bootstrapAccount.email}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log("Change this password immediately after the first login.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unable to create SUPER_ADMIN");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
