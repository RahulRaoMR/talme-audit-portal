import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { EmployeeForm } from "../components/EmployeeForm";
import {
  fetchEmployee,
  fetchEmployeeOptions,
  updateEmployee
} from "../services/employee.service";
import type { EmployeeFormInput, EmployeeOptions, EmployeeRecord } from "../types/employee";

export function EditEmployeePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [options, setOptions] = useState<EmployeeOptions | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchEmployee(id), fetchEmployeeOptions()])
      .then(([employeeResponse, optionsResponse]) => {
        setEmployee(employeeResponse.employee);
        setOptions(optionsResponse);
      })
      .catch((caughtError) =>
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load employee")
      );
  }, [id]);

  async function handleSubmit(input: EmployeeFormInput) {
    const { employeeCode: _employeeCode, email: _email, ...editableInput } = input;
    try {
      setError("");
      setIsSubmitting(true);
      await updateEmployee(id, editableInput);
      navigate(`/employees/${id}`, { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update employee");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!employee || !options) {
    return <p className="text-sm text-slate-600">{error || "Loading employee..."}</p>;
  }

  const initialValue: EmployeeFormInput = {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? "",
    departmentId: employee.department.id,
    designation: employee.designation,
    managerId: employee.manager?.id ?? "",
    joiningDate: employee.joiningDate.slice(0, 10),
    employmentStatus: employee.employmentStatus,
    roleName: employee.user?.role.name === "SUPER_ADMIN" ? "EMPLOYEE" : employee.user?.role.name ?? "EMPLOYEE"
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <Pencil className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Edit Employee</h1>
          <p className="mt-1 text-sm text-slate-500">{employee.employeeCode} · {employee.firstName} {employee.lastName}</p>
        </div>
      </header>

      <EmployeeForm
        mode="edit"
        options={options}
        initialValue={initialValue}
        currentEmployeeId={employee.id}
        isSubmitting={isSubmitting}
        error={error}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
