"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CarFront,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import {
  buildVehicleDetailLabel,
  buildVehicleLabel,
  fetchCustomerPortalData,
  type CustomerPortalVehicle,
} from "@/lib/customer-portal";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";

type FlowIntent = "book" | "request";

const steps = [
  { id: 1, label: "Choose how" },
  { id: 2, label: "Pick vehicle" },
  { id: 3, label: "Continue" },
];

function IntentCard({
  title,
  description,
  icon: Icon,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[24px] border-2 p-5 text-left transition ${
        selected
          ? "border-lime-500 bg-lime-400/15 shadow-[0_0_0_2px_rgba(132,204,22,0.25)]"
          : "border-slate-200 bg-white hover:border-lime-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`rounded-2xl p-3 ${
            selected ? "bg-lime-400 text-black" : "bg-slate-200 text-slate-800"
          }`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default function CustomerBookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<CustomerPortalVehicle[]>([]);
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState<FlowIntent | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { user, roles } = await getUserRoles();
        if (!user) {
          window.location.href = "/customer/login";
          return;
        }
        if (!hasPortalAccess(roles, "customer")) {
          window.location.href = getPostLoginRoute(roles);
          return;
        }
        const data = await fetchCustomerPortalData(user.id);
        if (!data.customer) {
          setLoading(false);
          return;
        }
        const list = (data.vehicles ?? []).filter((v) => Boolean(v.id));
        setVehicles(list);
        setSelectedVehicleId(list[0]?.id || "");
      } catch (e) {
        console.error("Book page load failed:", e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const goSchedule = () => {
    if (!intent || !selectedVehicleId) return;
    const flow = intent === "request" ? "request" : "book";
    const qs = new URLSearchParams({
      vehicle: selectedVehicleId,
      flow,
      guided: "1",
    });
    router.push(`/customer/schedule?${qs.toString()}`);
  };

  if (loading) {
    return (
      <div className="otg-page">
        <div className="otg-container">
          <div className="otg-card p-8">
            <p className="otg-body">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <CustomerPortalShell
        title="Get service"
        subtitle="Step-by-step: choose how you want to work with us, then we’ll open the right form."
        onLogout={handleLogout}
      >
        <div className="otg-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-900">
              <CarFront className="h-7 w-7" />
            </div>
            <div className="min-w-0 space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">Add a vehicle first</h2>
              <p className="text-sm leading-relaxed text-slate-600">
                We need at least one vehicle on your account before you can book or request service.
                Contact the shop or update your account so a vehicle can be linked.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/customer/account" className="otg-btn otg-btn-primary inline-flex w-fit items-center">
                  Open account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="/customer/dashboard" className="otg-btn otg-btn-secondary inline-flex w-fit items-center">
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </CustomerPortalShell>
    );
  }

  const stepIndex = Math.min(step, 3);
  const canContinueStep1 = intent !== null;
  const canContinueStep2 = Boolean(selectedVehicleId);

  return (
    <CustomerPortalShell
      title="Get service"
      subtitle="Follow the steps. We’ll carry your choices into the form so you only fill in what’s left."
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 sm:gap-4">
              <div
                className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-full text-sm font-semibold ${
                  stepIndex >= s.id
                    ? "bg-lime-400 text-black"
                    : "border border-slate-300 bg-white text-slate-500"
                }`}
              >
                {s.id}
              </div>
              <span
                className={`text-sm font-medium ${
                  stepIndex >= s.id ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 ? (
                <div className="hidden h-px w-6 bg-slate-300 sm:block" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>

        <div className="otg-card p-5 sm:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  How would you like to start?
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Pick one. You can change the service type on the next screen if needed.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <IntentCard
                  title="Book a date & time"
                  description="Choose an available appointment window. Best for oil changes, inspections, and routine visits."
                  icon={CalendarClock}
                  selected={intent === "book"}
                  onSelect={() => setIntent("book")}
                />
                <IntentCard
                  title="Send a request first"
                  description="Describe repairs or custom work. Our team reviews it and contacts you before a time is set."
                  icon={MessageSquare}
                  selected={intent === "request"}
                  onSelect={() => setIntent("request")}
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={!canContinueStep1}
                  onClick={() => setStep(2)}
                  className="otg-btn otg-btn-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  Next: vehicle
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  Which vehicle is this for?
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {intent === "book"
                    ? "We’ll use this when showing open times."
                    : "We’ll attach this vehicle to your service request."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {vehicles.map((v) => {
                  const id = v.id || "";
                  const active = selectedVehicleId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedVehicleId(id)}
                      className={`rounded-[22px] border-2 p-4 text-left transition ${
                        active
                          ? "border-lime-500 bg-lime-400/10"
                          : "border-slate-200 bg-slate-50 hover:border-lime-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CarFront className="h-5 w-5 shrink-0 text-slate-700" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{buildVehicleLabel(v)}</div>
                          <div className="mt-1 text-xs text-slate-600">{buildVehicleDetailLabel(v)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="otg-btn otg-btn-secondary sm:w-auto"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canContinueStep2}
                  onClick={() => setStep(3)}
                  className="otg-btn otg-btn-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  Next: review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  Ready to open the form
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Next you’ll confirm service type, location, and{" "}
                  {intent === "book" ? "pick a time slot" : "describe what you need"}.
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <ClipboardList className="h-4 w-4 text-lime-600" />
                  Summary
                </div>
                <ul className="mt-3 list-inside list-disc space-y-1">
                  <li>
                    <span className="font-medium">Flow:</span>{" "}
                    {intent === "book"
                      ? "Book with calendar"
                      : "Request review (no time yet)"}
                  </li>
                  <li>
                    <span className="font-medium">Vehicle:</span>{" "}
                    {buildVehicleLabel(
                      vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0],
                    )}
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="otg-btn otg-btn-secondary sm:w-auto"
                >
                  Back
                </button>
                <button type="button" onClick={goSchedule} className="otg-btn otg-btn-primary sm:w-auto">
                  Continue to service form
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
              <p className="text-center text-xs text-slate-500 sm:text-left">
                Prefer the full page without steps?{" "}
                <Link href="/customer/schedule" className="font-semibold text-lime-700 underline-offset-2 hover:underline">
                  Open scheduler directly
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </CustomerPortalShell>
  );
}
