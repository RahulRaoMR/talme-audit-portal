import { useEffect, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchEmployee } from "../services/employee.service";
import type { EmployeeRecord } from "../types/employee";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

export function EmployeeDetailsPage() {
  const { id = "" } = useParams();
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEmployee(id)
      .then((response) => setEmployee(response.employee))
      .catch((caughtError) =>
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load employee")
      );
  }, [id]);

  if (!employee) return <p className="text-sm text-slate-600">{error || "Loading employee..."}</p>;

  const details = [
    ["Employee Code", employee.employeeCode],
    ["Full Name", `${employee.firstName} ${employee.lastName}`],
    ["Email", employee.email],
    ["Phone", employee.phone || "Not provided"],
    ["Department", employee.department.name],
    ["Designation", employee.designation],
    ["Role", employee.user?.role.name.replace(/_/g, " ") ?? "Not assigned"],
    ["Reporting Manager", employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Not assigned"],
    ["Joining Date", formatDate(employee.joiningDate)],
    ["Employment Status", employee.employmentStatus.replace(/_/g, " ")],
    ["Account Status", employee.user?.isActive ? "Active" : "Inactive"],
    ["Created Date", formatDate(employee.createdAt)]
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950" to="/employees">
            <ArrowLeft className="h-4 w-4" /> Back to employees
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">{employee.firstName} {employee.lastName}</h1>
          <p className="mt-1 text-sm text-slate-500">{employee.employeeCode} · {employee.designation}</p>
        </div>
        {employee.user?.role.name !== "SUPER_ADMIN" ? (
          <Link className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600" to={`/employees/${employee.id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        ) : null}
      </header>

      <section className="border-y border-slate-200 bg-white sm:rounded-md sm:border">
        <dl className="grid md:grid-cols-2 xl:grid-cols-3">
          {details.map(([label, value]) => (
            <div className="border-b border-slate-100 px-5 py-4 xl:[&:nth-last-child(-n+3)]:border-b-0" key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="mt-1.5 text-sm font-medium text-slate-950">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-base font-bold text-slate-950">Employee Records</h2>
        <div className="mt-3 grid gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          {["Monthly Reports", "Attendance", "Quarterly Performance", "Audits"].map((item) => (
            <div className="bg-white px-5 py-5" key={item}>
              <h3 className="text-sm font-semibold text-slate-950">{item}</h3>
              <p className="mt-2 text-sm text-slate-500">Not available yet</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
