"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function JobsHubCard({
  title,
  description,
  icon: Icon,
  onClick,
  accent = "slate",
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  accent?: "lime" | "slate";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col rounded-2xl border-2 p-5 text-left transition sm:p-6",
        accent === "lime"
          ? "border-lime-400/50 bg-gradient-to-br from-lime-400/15 to-transparent hover:border-lime-400 hover:shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "rounded-xl p-3",
            accent === "lime" ? "bg-lime-400 text-black" : "bg-slate-100 text-slate-800"
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-lime-600" />
      </div>
      <div className="mt-4">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
    </button>
  );
}

export default function ManagerJobsHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const run = async () => {
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
      setLoading(false);
    };
    void run();
  }, []);

  if (loading || !authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Jobs</h1>
            <p className="mt-2 max-w-xl text-slate-600">
              Choose how you are working: add a job for someone new, someone already on file, or open the full job list.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <BackToPortalButton />
            <Button
              variant="outline"
              className={headerActionButtonClassName}
              onClick={() => router.push("/manager")}
            >
              Manager home
            </Button>
          </div>
        </div>

        <PortalTopNav section="manager" />

        <div className="grid gap-4 sm:grid-cols-2">
          <JobsHubCard
            accent="lime"
            icon={UserPlus}
            title="New customer"
            description="Create the customer record, then finish vehicle and service on the next screen."
            onClick={() => router.push("/manager/jobs/new?flow=new")}
          />
          <JobsHubCard
            icon={Users}
            title="Returning customer"
            description="Search your existing customers, pick a vehicle, and create the job."
            onClick={() => router.push("/manager/jobs/new?flow=returning")}
          />
        </div>

        <Card className="border-slate-200">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-3 text-slate-800">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">View all jobs</div>
                <p className="mt-1 text-sm text-slate-600">
                  Search, filter, assign techs, and open any job from the full list.
                </p>
              </div>
            </div>
            <Button
              className={cn(headerActionButtonClassName, "w-full shrink-0 sm:w-auto")}
              onClick={() => router.push("/manager/jobs/list")}
            >
              Open job list
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
