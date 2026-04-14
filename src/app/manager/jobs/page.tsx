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
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Jobs</h1>
            <p className="mt-2 max-w-xl text-slate-600">
              Pick a customer flow first, then create or find the job you need.
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

        <button
          type="button"
          onClick={() => router.push("/manager/jobs/new?flow=new")}
          className="w-full text-left"
        >
          <Card className="border-2 border-lime-400/60 bg-gradient-to-br from-lime-100 to-white transition-shadow hover:shadow-md">
            <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-lime-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black">
                  <UserPlus className="h-4 w-4" />
                  Primary flow
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Start with new customer</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-700">
                  Add customer, then vehicle, then service details in one guided path.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                Open new-customer flow
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </button>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/manager/jobs/new?flow=returning")}
            className="text-left"
          >
            <Card className="h-full border-slate-200 transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <Users className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">Returning customer</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    Search someone on file, select their vehicle, and create the job quickly.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  Open returning flow
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            onClick={() => router.push("/manager/jobs/list")}
            className="text-left"
          >
            <Card className="h-full border-slate-200 transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <ClipboardList className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">View all jobs</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    Search, filter, assign techs, and open any job from the full list.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  Open list
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
}
