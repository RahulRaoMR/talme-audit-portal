import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Power,
  Search,
  UserPlus,
  Users
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchEmployeeOptions,
  fetchEmployees,
  updateEmployeeStatus,
  type EmployeeFilters
} from "../services/employee.service";
import type { EmployeeListResponse, EmployeeOptions, EmployeeRecord } from "../types/employee";

const selectClass =
  "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

export function EmployeeListPage() {
  const [filters, setFilters] = useState<EmployeeFilters>({ page: 1, pageSize: 10 });
  const [result, setResult] = useState<EmployeeListResponse | null>(null);
  const [options, setOptions] = useState<EmployeeOptions | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusEmployeeId, setStatusEmployeeId] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      setResult(await fetchEmployees(filters));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load employees");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    fetchEmployeeOptions().then(setOptions).catch(() => undefined);
  }, []);

  function setFilter(key: keyof EmployeeFilters, value: string | number) {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
  }

  async function toggleStatus(employee: EmployeeRecord) {
    if (!employee.user || employee.user.role.name === "SUPER_ADMIN") return;
    try {
      setStatusEmployeeId(employee.id);
      await updateEmployeeStatus(employee.id, !employee.user.isActive);
      await loadEmployees();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update account status");
    } finally {
      setStatusEmployeeId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-50 text-brand-700">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Employees</h1>
            <p className="mt-1 text-sm text-slate-500">
              {result ? `${result.pagination.total} employee records` : "Employee directory"}
            </p>
          </div>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          to="/employees/new"
        >
          <UserPlus className="h-4 w-4" /> Add Employee
        </Link>
      </header>

      <section className="border-y border-slate-200 bg-white px-4 py-4 sm:rounded-md sm:border">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_repeat(4,minmax(150px,auto))]">
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              value={filters.search ?? ""}
              onChange={(event) => setFilter("search", event.target.value)}
              placeholder="Search name, email, or code"
            />
          </label>

          <select className={selectClass} value={filters.departmentId ?? ""} onChange={(event) => setFilter("departmentId", event.target.value)} aria-label="Department filter">
            <option value="">All departments</option>
            {options?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>

          <select className={selectClass} value={filters.roleName ?? ""} onChange={(event) => setFilter("roleName", event.target.value)} aria-label="Role filter">
            <option value="">All roles</option>
            {["EMPLOYEE", "MANAGER", "HR_ADMIN", "AUDITOR", "SUPER_ADMIN"].map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}
          </select>

          <select className={selectClass} value={filters.employmentStatus ?? ""} onChange={(event) => setFilter("employmentStatus", event.target.value)} aria-label="Employment status filter">
            <option value="">All employment statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="TERMINATED">Terminated</option>
          </select>

          <select className={selectClass} value={filters.isActive ?? ""} onChange={(event) => setFilter("isActive", event.target.value)} aria-label="Account status filter">
            <option value="">All accounts</option>
            <option value="true">Active accounts</option>
            <option value="false">Inactive accounts</option>
          </select>
        </div>
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="overflow-hidden border-y border-slate-200 bg-white sm:rounded-md sm:border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                {["Code", "Employee", "Email", "Department", "Designation", "Role", "Reporting Manager", "Joining Date", "Employment", "Account", "Actions"].map((heading) => (
                  <th className="border-b border-slate-200 px-4 py-3" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result?.employees.map((employee) => (
                <tr className="hover:bg-slate-50" key={employee.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">{employee.employeeCode}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{employee.firstName} {employee.lastName}</td>
                  <td className="px-4 py-3 text-slate-600">{employee.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{employee.department.name}</td>
                  <td className="px-4 py-3 text-slate-600">{employee.designation}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{employee.user?.role.name.replace(/_/g, " ") ?? "Not assigned"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Not assigned"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(employee.joiningDate)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{employee.employmentStatus.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${employee.user?.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {employee.user?.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950" to={`/employees/${employee.id}`} title="View employee" aria-label="View employee"><Eye className="h-4 w-4" /></Link>
                      {employee.user?.role.name !== "SUPER_ADMIN" ? (
                        <>
                          <Link className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950" to={`/employees/${employee.id}/edit`} title="Edit employee" aria-label="Edit employee"><Pencil className="h-4 w-4" /></Link>
                          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:opacity-40" type="button" onClick={() => void toggleStatus(employee)} disabled={statusEmployeeId === employee.id} title={employee.user?.isActive ? "Deactivate account" : "Activate account"} aria-label={employee.user?.isActive ? "Deactivate account" : "Activate account"}><Power className="h-4 w-4" /></button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && result?.employees.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No employees match these filters.</p>
        ) : null}
        {isLoading ? <p className="px-6 py-12 text-center text-sm text-slate-500">Loading employees...</p> : null}

        {result ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">Page {result.pagination.page} of {result.pagination.totalPages}</p>
            <div className="flex items-center gap-2">
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40" type="button" disabled={result.pagination.page <= 1} onClick={() => setFilter("page", result.pagination.page - 1)} aria-label="Previous page" title="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40" type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setFilter("page", result.pagination.page + 1)} aria-label="Next page" title="Next page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
