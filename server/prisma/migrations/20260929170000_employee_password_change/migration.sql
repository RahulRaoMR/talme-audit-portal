-- AddColumn
ALTER TABLE "User"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- Employee data is accessed only through the authenticated Express backend.
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Department", "Role", "Employee", "User" FROM PUBLIC;

DO $permissions$
DECLARE api_role text;
BEGIN
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
        EXECUTE format('REVOKE ALL ON TABLE "Department", "Role", "Employee", "User" FROM %I', api_role);
    END LOOP;
END;
$permissions$;
