import { useState, type FormEvent } from "react";
import { Save, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { EmployeeFormInput, EmployeeOptions } from "../types/employee";

type EmployeeFormProps = {
  mode: "create" | "edit";
  options: EmployeeOptions;
  initialValue: EmployeeFormInput;
  currentEmployeeId?: string;
  isSubmitting: boolean;
  error: string;
  onSubmit: (input: EmployeeFormInput) => Promise<void>;
};

const fieldClass =
  "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500";

export function EmployeeForm({
  mode,
  options,
  initialValue,
  currentEmployeeId,
  isSubmitting,
  error,
  onSubmit
}: EmployeeFormProps) {
  const [form, setForm] = useState(initialValue);

  function update<Key extends keyof EmployeeFormInput>(key: Key, value: EmployeeFormInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(form);
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="border-y border-slate-200 bg-white px-4 py-6 sm:rounded-md sm:border sm:px-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Employee Code</span>
            <input
              className={fieldClass}
              value={form.employeeCode}
              onChange={(event) => update("employeeCode", event.target.value)}
              disabled={mode === "edit"}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">First Name</span>
            <input
              className={fieldClass}
              value={form.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Last Name</span>
            <input
              className={fieldClass}
              value={form.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className={fieldClass}
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              disabled={mode === "edit"}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Phone</span>
            <input
              className={fieldClass}
              type="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Department</span>
            <select
              className={fieldClass}
              value={form.departmentId}
              onChange={(event) => update("departmentId", event.target.value)}
              required
            >
              <option value="">Select department</option>
              {options.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Designation</span>
            <input
              className={fieldClass}
              value={form.designation}
              onChange={(event) => update("designation", event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Reporting Manager</span>
            <select
              className={fieldClass}
              value={form.managerId}
              onChange={(event) => update("managerId", event.target.value)}
            >
              <option value="">No reporting manager</option>
              {options.managers
                .filter((manager) => manager.id !== currentEmployeeId)
                .map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.firstName} {manager.lastName} ({manager.employeeCode})
                  </option>
                ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Joining Date</span>
            <input
              className={fieldClass}
              type="date"
              value={form.joiningDate}
              onChange={(event) => update("joiningDate", event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Employment Status</span>
            <select
              className={fieldClass}
              value={form.employmentStatus}
              onChange={(event) =>
                update("employmentStatus", event.target.value as EmployeeFormInput["employmentStatus"])
              }
              required
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select
              className={fieldClass}
              value={form.roleName}
              onChange={(event) =>
                update("roleName", event.target.value as EmployeeFormInput["roleName"])
              }
              required
            >
              {options.roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Link
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          to="/employees"
        >
          <X className="h-4 w-4" />
          Cancel
        </Link>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:bg-slate-400"
          type="submit"
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? "Saving..." : mode === "create" ? "Create Employee" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
