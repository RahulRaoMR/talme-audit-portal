import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { EmployeeForm } from "../components/EmployeeForm";
import { TemporaryPasswordModal } from "../components/TemporaryPasswordModal";
import { createEmployee, fetchEmployeeOptions } from "../services/employee.service";
import type { EmployeeFormInput, EmployeeOptions } from "../types/employee";

const initialForm: EmployeeFormInput = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  departmentId: "",
  designation: "",
  managerId: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  employmentStatus: "ACTIVE",
  roleName: "EMPLOYEE"
};

export function NewEmployeePage() {
  const [options, setOptions] = useState<EmployeeOptions | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    employeeCode: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);

  useEffect(() => {
    fetchEmployeeOptions()
      .then(setOptions)
      .catch((caughtError) =>
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load form options")
      );
  }, []);

  async function handleSubmit(input: EmployeeFormInput) {
    try {
      setError("");
      setIsSubmitting(true);
      const response = await createEmployee(input);
      setCreated({
        employeeCode: response.employee.employeeCode,
        email: response.employee.email,
        temporaryPassword: response.temporaryPassword
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create employee");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <UserPlus className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Add Employee</h1>
          <p className="mt-1 text-sm text-slate-500">Create the employee profile and login account together.</p>
        </div>
      </header>

      {options ? (
        <EmployeeForm
          mode="create"
          options={options}
          initialValue={initialForm}
          isSubmitting={isSubmitting}
          error={error}
          onSubmit={handleSubmit}
        />
      ) : (
        <p className="text-sm text-slate-600">{error || "Loading employee options..."}</p>
      )}

      {created ? <TemporaryPasswordModal {...created} /> : null}
    </div>
  );
}
