-- AddColumn
ALTER TABLE "User"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- Employee data is accessed only through the authenticated Express backend.
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Department" FROM anon, authenticated;
REVOKE ALL ON TABLE "Role" FROM anon, authenticated;
REVOKE ALL ON TABLE "Employee" FROM anon, authenticated;
REVOKE ALL ON TABLE "User" FROM anon, authenticated;
