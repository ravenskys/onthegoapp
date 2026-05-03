"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { getErrorMessage } from "@/lib/tech-inspection";
import { cn } from "@/lib/utils";

/** PostgREST: table not exposed / not in schema cache (migration not applied). */
function isPayRatesTableMissingError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const o = err as { code?: string; message?: string };
  if (o.code === "PGRST205") return true;
  const msg = String(o.message ?? "");
  return msg.includes("Could not find the table") && msg.includes("technician_pay_rates");
}

const PAY_RATES_SETUP_INSTRUCTIONS =
  "Create the table by applying the migration: open Supabase Dashboard -> SQL Editor, paste and run the file " +
  "supabase/migrations/20260415120000_create_technician_pay_rates.sql from this project, " +
  "or from the tech-app folder run: npx supabase db push. Then refresh this page.";

function formatLoadError(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object") {
    const o = err as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    const parts = [o.message, o.code, o.details, o.hint].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    if (parts.length > 0) return parts.join(" | ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

type EmployeeAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employmentStatus: string;
  roles: string[];
  canEdit: boolean;
  adminOnlyTarget: boolean;
};

type EmployeeAuditEntry = {
  id: string;
  actor_email: string | null;
  actor_roles: string[] | null;
  target_email: string | null;
  action_type: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  created_at: string;
};

type Technician = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type PayRateRow = {
  id: string;
  technician_user_id: string;
  hourly_pay: number;
  effective_date: string;
  notes: string | null;
};

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On Leave" },
  { value: "terminated", label: "Terminated" },
] as const;

const managerDarkFieldClassName = cn(
  "border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]",
  "placeholder:text-[#7f9988]",
);

function getEmployeeLabel(employee: Pick<EmployeeAccount, "firstName" | "lastName" | "email">) {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return name || employee.email || "Employee";
}

function getTechnicianLabel(tech: Technician) {
  const name = [tech.firstName, tech.lastName].filter(Boolean).join(" ").trim();
  return name || tech.email || "Technician";
}

export default function ManagerEmployeesPage() {
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [employeesMessage, setEmployeesMessage] = useState("");
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const [requesterIsAdmin, setRequesterIsAdmin] = useState(false);
  const [auditEntries, setAuditEntries] = useState<EmployeeAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditMessage, setAuditMessage] = useState("");

  const [payRates, setPayRates] = useState<PayRateRow[]>([]);
  const [payRatesLoadError, setPayRatesLoadError] = useState<string | null>(null);
  const [payRatesTableMissing, setPayRatesTableMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newTechId, setNewTechId] = useState("");
  const [newEffectiveDate, setNewEffectiveDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [newHourlyPay, setNewHourlyPay] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const fetchEmployeeAccounts = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeesMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session expired. Please log in again.");
      }

      const response = await fetch("/api/internal/employees", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to load employees.");
      }

      setRequesterIsAdmin(Boolean(result.requesterIsAdmin));
      setEmployees((result.employees ?? []) as EmployeeAccount[]);
    } catch (error) {
      console.error("Manager employees load failed:", formatLoadError(error));
      setEmployeesMessage(getErrorMessage(error, "Failed to load employees."));
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  const fetchAuditEntries = useCallback(async () => {
    setAuditLoading(true);
    setAuditMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session expired. Please log in again.");
      }

      const response = await fetch("/api/internal/employees/audit", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to load employee audit.");
      }

      setAuditEntries((result.entries ?? []) as EmployeeAuditEntry[]);
    } catch (error) {
      console.error("Employee audit load failed:", formatLoadError(error));
      setAuditMessage(getErrorMessage(error, "Could not load the employee audit log."));
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadPayRates = useCallback(async () => {
    const ratesResult = await supabase
      .from("technician_pay_rates")
      .select("id, technician_user_id, hourly_pay, effective_date, notes")
      .order("effective_date", { ascending: false });

    if (ratesResult.error) {
      const missing = isPayRatesTableMissingError(ratesResult.error);
      setPayRatesTableMissing(missing);
      setPayRates([]);
      if (missing) {
        setPayRatesLoadError(PAY_RATES_SETUP_INSTRUCTIONS);
      } else {
        console.warn("technician_pay_rates load failed:", formatLoadError(ratesResult.error));
        setPayRatesLoadError(
          getErrorMessage(
            ratesResult.error,
            "Pay rates could not be loaded. Check manager permissions or try again.",
          ),
        );
      }
    } else {
      setPayRatesTableMissing(false);
      setPayRates((ratesResult.data || []) as PayRateRow[]);
      setPayRatesLoadError(null);
    }
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([fetchEmployeeAccounts(), loadPayRates()]);
  }, [fetchEmployeeAccounts, loadPayRates]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadData();
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadData]);

  useEffect(() => {
    if (requesterIsAdmin) {
      void fetchAuditEntries();
    }
  }, [fetchAuditEntries, requesterIsAdmin]);

  const technicians = useMemo<Technician[]>(
    () =>
      employees
        .filter((employee) => employee.roles.includes("technician"))
        .map((employee) => ({
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
        })),
    [employees],
  );

  const techById = useMemo(() => {
    const map = new Map<string, Technician>();
    technicians.forEach((tech) => map.set(tech.id, tech));
    return map;
  }, [technicians]);

  const technicianSelectValue = useMemo(() => {
    if (technicians.length === 0) return undefined;
    return technicians.some((t) => t.id === newTechId) ? newTechId : technicians[0].id;
  }, [technicians, newTechId]);

  useEffect(() => {
    if (!technicianSelectValue) return;
    if (newTechId !== technicianSelectValue) {
      setNewTechId(technicianSelectValue);
    }
  }, [technicianSelectValue, newTechId]);

  const handleEmployeeDraftChange = (
    employeeId: string,
    field: keyof Pick<EmployeeAccount, "firstName" | "lastName" | "email" | "employmentStatus">,
    value: string,
  ) => {
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === employeeId ? { ...employee, [field]: value } : employee,
      ),
    );
  };

  const handleSaveEmployee = async (employee: EmployeeAccount) => {
    setSavingEmployeeId(employee.id);
    setEmployeesMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session expired. Please log in again.");
      }

      const response = await fetch(`/api/internal/employees/${employee.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          employmentStatus: employee.employmentStatus,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to save employee.");
      }

      setEmployees((current) =>
        current.map((row) => (row.id === employee.id ? { ...row, ...result.employee } : row)),
      );
      setEmployeesMessage(`Saved ${getEmployeeLabel(employee)}.`);
      if (requesterIsAdmin) {
        void fetchAuditEntries();
      }
    } catch (error) {
      setEmployeesMessage(getErrorMessage(error, "Failed to save employee."));
    } finally {
      setSavingEmployeeId(null);
    }
  };

  const handleAddRate = async () => {
    if (payRatesTableMissing) {
      alert(PAY_RATES_SETUP_INSTRUCTIONS);
      return;
    }

    const techId = newTechId || technicians[0]?.id;
    if (!techId) {
      alert("Select a technician.");
      return;
    }

    const pay = Number(String(newHourlyPay).trim());
    if (!Number.isFinite(pay) || pay < 0) {
      alert("Enter a valid hourly pay amount.");
      return;
    }
    if (!newEffectiveDate.trim()) {
      alert("Choose an effective date.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("technician_pay_rates").insert({
        technician_user_id: techId,
        hourly_pay: pay,
        effective_date: newEffectiveDate.trim(),
        notes: newNotes.trim() || null,
      });
      if (error) throw error;
      setNewHourlyPay("");
      setNewNotes("");
      await loadPayRates();
    } catch (error: unknown) {
      if (isPayRatesTableMissingError(error)) {
        setPayRatesTableMissing(true);
        setPayRatesLoadError(PAY_RATES_SETUP_INSTRUCTIONS);
        alert(PAY_RATES_SETUP_INSTRUCTIONS);
      } else {
        console.warn("Save pay rate failed:", formatLoadError(error));
        alert(getErrorMessage(error, "Could not save pay rate."));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRate = async (id: string) => {
    if (payRatesTableMissing) return;
    if (!window.confirm("Remove this pay rate row?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("technician_pay_rates").delete().eq("id", id);
      if (error) throw error;
      await loadPayRates();
    } catch (error) {
      if (isPayRatesTableMissingError(error)) {
        setPayRatesTableMissing(true);
        setPayRatesLoadError(PAY_RATES_SETUP_INSTRUCTIONS);
        alert(PAY_RATES_SETUP_INSTRUCTIONS);
      } else {
        console.warn("Delete pay rate failed:", formatLoadError(error));
        alert(getErrorMessage(error, "Could not delete."));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Employees</h1>
            <p className="text-slate-600">
              Managers and admins can maintain staff account details. Manager and admin accounts are editable by admins only.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <BackToPortalButton />
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadData()}
              disabled={saving || employeesLoading}
              className={headerActionButtonClassName}
            >
              Refresh
            </Button>
          </div>
        </div>

        <PortalTopNav section="manager" />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              Employee Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {employeesMessage ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {employeesMessage}
              </div>
            ) : null}

            {employeesLoading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
                Loading employee accounts...
              </div>
            ) : employees.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
                No employee accounts were found yet.
              </div>
            ) : (
              employees.map((employee) => (
                <div
                  key={employee.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3 lg:flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {getEmployeeLabel(employee)}
                        </h3>
                        {employee.roles.map((role) => (
                          <span
                            key={`${employee.id}-${role}`}
                            className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                          >
                            {role}
                          </span>
                        ))}
                        {employee.adminOnlyTarget ? (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">
                            Admin only
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          <Input
                            value={employee.firstName}
                            onChange={(event) =>
                              handleEmployeeDraftChange(employee.id, "firstName", event.target.value)
                            }
                            disabled={!employee.canEdit || savingEmployeeId === employee.id}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input
                            value={employee.lastName}
                            onChange={(event) =>
                              handleEmployeeDraftChange(employee.id, "lastName", event.target.value)
                            }
                            disabled={!employee.canEdit || savingEmployeeId === employee.id}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={employee.email}
                            onChange={(event) =>
                              handleEmployeeDraftChange(employee.id, "email", event.target.value.trim().toLowerCase())
                            }
                            disabled={!employee.canEdit || savingEmployeeId === employee.id}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Employment Status</Label>
                          <Select
                            value={employee.employmentStatus}
                            onValueChange={(value) =>
                              handleEmployeeDraftChange(employee.id, "employmentStatus", value)
                            }
                            disabled={!employee.canEdit || savingEmployeeId === employee.id}
                          >
                            <SelectTrigger className={managerDarkFieldClassName}>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[220px]">
                      {employee.canEdit ? (
                        <Button
                          type="button"
                          className={cn("w-full", headerActionButtonClassName)}
                          disabled={savingEmployeeId === employee.id}
                          onClick={() => void handleSaveEmployee(employee)}
                        >
                          {savingEmployeeId === employee.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save Account
                        </Button>
                      ) : (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                          Only admins can edit manager or admin accounts.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {requesterIsAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Employee Change Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditMessage ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  {auditMessage}
                </div>
              ) : null}
              {auditLoading ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
                  Loading employee audit...
                </div>
              ) : auditEntries.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
                  No tracked employee account changes yet.
                </div>
              ) : (
                auditEntries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {entry.target_email || "Unknown employee"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Changed by {entry.actor_email || "Unknown admin"}{" "}
                          {entry.actor_roles?.length ? `(${entry.actor_roles.join(", ")})` : ""}
                        </div>
                      </div>
                      <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        {new Date(entry.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">Before</div>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
                          {JSON.stringify(entry.old_values, null, 2)}
                        </pre>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">After</div>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
                          {JSON.stringify(entry.new_values, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        {payRatesLoadError ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              payRatesTableMissing
                ? "border-red-300 bg-red-50 text-red-950"
                : "border-amber-300 bg-amber-50 text-amber-950"
            }`}
          >
            <strong className="font-semibold">
              {payRatesTableMissing ? "Database setup required." : "Pay rates unavailable."}
            </strong>{" "}
            {payRatesLoadError}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              Technician Pay
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Technician</Label>
              {technicians.length === 0 ? (
                <div
                  className={cn(
                    "flex h-10 items-center rounded-md border px-3 text-sm text-[#7f9988]",
                    managerDarkFieldClassName,
                  )}
                >
                  No technicians found.
                </div>
              ) : (
                <Select
                  value={technicianSelectValue}
                  onValueChange={(value) => setNewTechId(value)}
                  disabled={payRatesTableMissing}
                >
                  <SelectTrigger className={managerDarkFieldClassName}>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {getTechnicianLabel(tech)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                className={managerDarkFieldClassName}
                value={newEffectiveDate}
                onChange={(event) => setNewEffectiveDate(event.target.value)}
                disabled={payRatesTableMissing}
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly Pay ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className={managerDarkFieldClassName}
                value={newHourlyPay}
                onChange={(event) => setNewHourlyPay(event.target.value)}
                placeholder="e.g. 32.50"
                disabled={payRatesTableMissing}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className={cn("w-full", headerActionButtonClassName)}
                disabled={saving || technicians.length === 0 || payRatesTableMissing}
                onClick={() => void handleAddRate()}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Rate
              </Button>
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <Label className="text-[#c5dcc9]">Notes (optional)</Label>
              <Input
                className={managerDarkFieldClassName}
                value={newNotes}
                onChange={(event) => setNewNotes(event.target.value)}
                placeholder="e.g. annual review, promotion"
                disabled={payRatesTableMissing}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pay History</CardTitle>
          </CardHeader>
          <CardContent>
            {payRates.length === 0 ? (
              <p className="text-sm text-slate-500">No pay rates yet. Add one above.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Technician</th>
                      <th className="px-3 py-2">Effective Date</th>
                      <th className="px-3 py-2">Hourly Pay</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="w-24 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {payRates.map((row) => {
                      const tech = techById.get(row.technician_user_id);
                      return (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {tech ? getTechnicianLabel(tech) : row.technician_user_id}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{row.effective_date}</td>
                          <td className="px-3 py-2 font-mono text-slate-900">
                            ${Number(row.hourly_pay).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.notes || "-"}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              disabled={saving}
                              onClick={() => void handleDeleteRate(row.id)}
                              aria-label="Delete pay rate"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
