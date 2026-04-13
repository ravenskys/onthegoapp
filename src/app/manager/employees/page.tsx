"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, UserRound } from "lucide-react";
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
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { getErrorMessage } from "@/lib/tech-inspection";
import { cn } from "@/lib/utils";

/** PostgREST: table not exposed / not in schema cache (migration not applied). */
function isPayRatesTableMissingError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const o = err as { code?: string; message?: string };
  if (o.code === "PGRST205") return true;
  const msg = String(o.message ?? "");
  return (
    msg.includes("Could not find the table") && msg.includes("technician_pay_rates")
  );
}

const PAY_RATES_SETUP_INSTRUCTIONS =
  "Create the table by applying the migration: open Supabase Dashboard → SQL Editor, paste and run the file " +
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
      (p): p is string => typeof p === "string" && p.length > 0
    );
    if (parts.length > 0) return parts.join(" — ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

type Technician = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type PayRateRow = {
  id: string;
  technician_user_id: string;
  hourly_pay: number;
  effective_date: string;
  notes: string | null;
};

const managerDarkFieldClassName = cn(
  "border-[rgba(115,145,126,0.35)] bg-[#121b14] text-[#f3fff4]",
  "placeholder:text-[#7f9988]"
);

function getTechnicianLabel(tech: Technician) {
  const name = [tech.first_name, tech.last_name].filter(Boolean).join(" ").trim();
  return name || tech.email || "Technician";
}

export default function ManagerEmployeesPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [payRates, setPayRates] = useState<PayRateRow[]>([]);
  const [payRatesLoadError, setPayRatesLoadError] = useState<string | null>(null);
  const [payRatesTableMissing, setPayRatesTableMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newTechId, setNewTechId] = useState("");
  const [newEffectiveDate, setNewEffectiveDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newHourlyPay, setNewHourlyPay] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const loadData = useCallback(async () => {
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "technician");

    if (roleError) throw roleError;

    const techIds = (roleRows || []).map((r) => r.user_id).filter(Boolean);

    const profilesResult = techIds.length
      ? await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", techIds)
      : { data: [] as Technician[], error: null as null };

    if (profilesResult.error) throw profilesResult.error;

    setTechnicians((profilesResult.data || []) as Technician[]);

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
            "Pay rates could not be loaded. Check manager permissions or try again."
          )
        );
      }
    } else {
      setPayRatesTableMissing(false);
      setPayRates((ratesResult.data || []) as PayRateRow[]);
      setPayRatesLoadError(null);
    }

    setNewTechId((current) => {
      if (current && techIds.includes(current)) return current;
      return techIds[0] ?? "";
    });
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const { user, roles } = await getUserRoles();
        if (!user) {
          window.location.href = "/customer/login";
          return;
        }
        if (!hasPortalAccess(roles, "manager")) {
          window.location.href = getPostLoginRoute(roles);
          return;
        }
        setAuthorized(true);
        await loadData();
      } catch (e) {
        console.error("Manager employees load failed:", formatLoadError(e));
        alert(getErrorMessage(e, "Failed to load employees."));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadData]);

  const techById = useMemo(() => {
    const m = new Map<string, Technician>();
    technicians.forEach((t) => m.set(t.id, t));
    return m;
  }, [technicians]);

  /** Radix Select requires `value` to match an item; avoid empty string with no items. */
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
      await loadData();
    } catch (e: unknown) {
      if (isPayRatesTableMissingError(e)) {
        setPayRatesTableMissing(true);
        setPayRatesLoadError(PAY_RATES_SETUP_INSTRUCTIONS);
        alert(PAY_RATES_SETUP_INSTRUCTIONS);
      } else {
        console.warn("Save pay rate failed:", formatLoadError(e));
        alert(getErrorMessage(e, "Could not save pay rate."));
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
      await loadData();
    } catch (e) {
      if (isPayRatesTableMissingError(e)) {
        setPayRatesTableMissing(true);
        setPayRatesLoadError(PAY_RATES_SETUP_INSTRUCTIONS);
        alert(PAY_RATES_SETUP_INSTRUCTIONS);
      } else {
        console.warn("Delete pay rate failed:", formatLoadError(e));
        alert(getErrorMessage(e, "Could not delete."));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Employees — technician pay</h1>
            <p className="text-slate-600">
              Hourly pay with effective dates drives per-technician shop labor cost on new jobs (when a
              technician is assigned).
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <BackToPortalButton />
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadData()}
              disabled={saving}
              className={headerActionButtonClassName}
            >
              Refresh
            </Button>
          </div>
        </div>

        <PortalTopNav section="manager" />

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
              Add pay rate
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Technician</Label>
              {technicians.length === 0 ? (
                <div
                  className={cn(
                    "flex h-10 items-center rounded-md border px-3 text-sm text-[#7f9988]",
                    managerDarkFieldClassName
                  )}
                >
                  No technicians found (assign the technician role in Admin).
                </div>
              ) : (
                <Select
                  value={technicianSelectValue}
                  onValueChange={(v) => setNewTechId(v)}
                  disabled={payRatesTableMissing}
                >
                  <SelectTrigger className={managerDarkFieldClassName}>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {getTechnicianLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Effective date</Label>
              <Input
                type="date"
                className={managerDarkFieldClassName}
                value={newEffectiveDate}
                onChange={(e) => setNewEffectiveDate(e.target.value)}
                disabled={payRatesTableMissing}
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly pay ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className={managerDarkFieldClassName}
                value={newHourlyPay}
                onChange={(e) => setNewHourlyPay(e.target.value)}
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
                Save rate
              </Button>
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <Label className="text-[#c5dcc9]">Notes (optional)</Label>
              <Input
                className={managerDarkFieldClassName}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. annual review, promotion"
                disabled={payRatesTableMissing}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pay history</CardTitle>
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
                      <th className="px-3 py-2">Effective date</th>
                      <th className="px-3 py-2">Hourly pay</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2 w-24" />
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
                          <td className="px-3 py-2 text-slate-600">{row.notes || "—"}</td>
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
