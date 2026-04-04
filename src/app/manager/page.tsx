"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPostLoginRoute, getUserRoles, hasAnyRole } from "@/lib/portal-auth";
import {
  Loader2,
  Briefcase,
  Users,
  PlusCircle,
  ClipboardList,
  Wrench,
} from "lucide-react";

export default function ManagerHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [openJobsCount, setOpenJobsCount] = useState(0);
  const [unassignedJobsCount, setUnassignedJobsCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      try {
        const { user, roles } = await getUserRoles();
        if (!user) {
          window.location.href = "/customer/login";
          return;
        }

        if (!hasAnyRole(roles, ["manager", "admin"])) {
          window.location.href = getPostLoginRoute(roles);
          return;
        }

        setAuthorized(true);

        const [
          { count: openJobs, error: openJobsError },
          { count: unassignedJobs, error: unassignedJobsError },
          { count: customers, error: customersError },
        ] = await Promise.all([
          supabase
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .in("status", ["new_request", "in_progress"]),

          supabase
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .in("status", ["new_request", "in_progress"])
            .is("assigned_tech_user_id", null),

          supabase
            .from("customers")
            .select("*", { count: "exact", head: true }),
        ]);

        if (openJobsError) throw openJobsError;
        if (unassignedJobsError) throw unassignedJobsError;
        if (customersError) throw customersError;

        setOpenJobsCount(openJobs ?? 0);
        setUnassignedJobsCount(unassignedJobs ?? 0);
        setCustomersCount(customers ?? 0);
      } catch (error) {
        console.error("Error loading manager dashboard:", error);
        alert("Failed to load manager dashboard.");
      } finally {
        setLoading(false);
      }
    };

    checkAccessAndLoad();
  }, []);

  if (loading || !authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="otg-manager-shell min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Manager Dashboard</h1>
            <p className="mt-1 text-slate-600">
              Manage jobs, customers, and daily workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              className="border-2 border-slate-900 shadow-sm"
              onClick={() => router.push("/manager/jobs/new")}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Job
            </Button>

            <Button
              variant="outline"
              className="border-2 border-slate-300 bg-white shadow-sm"
              onClick={() => router.push("/manager/jobs")}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Open Jobs Dashboard
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Open Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{openJobsCount}</div>
              <p className="mt-1 text-sm text-slate-500">
                New requests and in-progress jobs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Unassigned Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {unassignedJobsCount}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Jobs that still need a technician
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{customersCount}</div>
              <p className="mt-1 text-sm text-slate-500">
                Total customer records
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
              <div>
                <div className="mb-3 flex items-center gap-2 text-slate-900">
                  <ClipboardList className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Jobs</h2>
                </div>
                <p className="text-sm text-slate-600">
                  View all jobs, update statuses, assign technicians, and manage work.
                </p>
              </div>
              <Button
                className="h-10 w-full justify-center border-2 border-slate-900 shadow-sm"
                onClick={() => router.push("/manager/jobs")}
              >
                Open Jobs
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
              <div>
                <div className="mb-3 flex items-center gap-2 text-slate-900">
                  <Users className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Customers</h2>
                </div>
                <p className="text-sm text-slate-600">
                  Manage customer details, tax status, and vehicles.
                </p>
              </div>
              <Button variant="outline" onClick={() => router.push("/manager/customers")}>
                Open Customers
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
              <div>
                <div className="mb-3 flex items-center gap-2 text-slate-900">
                  <PlusCircle className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">New Job</h2>
                </div>
                <p className="text-sm text-slate-600">
                  Start a new service job with the fast intake flow.
                </p>
              </div>
              <Button
                className="h-10 w-full justify-center border-2 border-slate-900 shadow-sm"
                onClick={() => router.push("/manager/jobs/new")}
              >
                Create Job
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
              <div>
                <div className="mb-3 flex items-center gap-2 text-slate-900">
                  <Wrench className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Admin Settings</h2>
                </div>
                <p className="text-sm text-slate-600">
                  Update default tax settings and other internal business controls.
                </p>
              </div>
              <Button variant="outline" onClick={() => router.push("/admin/settings")}>
                Open Settings
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => router.push("/manager/jobs")}>
              <Briefcase className="mr-2 h-4 w-4" />
              View All Jobs
            </Button>

            <Button variant="outline" onClick={() => router.push("/manager/jobs/new")}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Job
            </Button>

            <Button variant="outline" onClick={() => router.push("/manager/customers")}>
              <Users className="mr-2 h-4 w-4" />
              Customers
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
