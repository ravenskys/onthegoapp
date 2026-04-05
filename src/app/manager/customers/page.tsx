"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Search, Users, PlusCircle } from "lucide-react";
import { getPostLoginRoute, getUserRoles, hasAnyRole } from "@/lib/portal-auth";
import { BackToPortalButton } from "@/components/portal/BackToPortalButton";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  tax_exempt: boolean;
};

type Vehicle = {
  customer_id: string;
};

export default function ManagerCustomersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicleCounts, setVehicleCounts] = useState<Record<string, number>>({});

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
        await fetchCustomers();
      } catch (error) {
        console.error("Error loading customers page:", error);
        alert("Failed to load customers.");
      } finally {
        setLoading(false);
      }
    };

    checkAccessAndLoad();
  }, []);

  const fetchCustomers = async () => {
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, phone, tax_exempt")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (customerError) {
      throw customerError;
    }

    const { data: vehicleData, error: vehicleError } = await supabase
      .from("vehicles")
      .select("customer_id");

    if (vehicleError) {
      throw vehicleError;
    }

    const counts = (vehicleData ?? []).reduce<Record<string, number>>(
      (accumulator, vehicle: Vehicle) => {
        accumulator[vehicle.customer_id] = (accumulator[vehicle.customer_id] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    setCustomers(customerData ?? []);
    setVehicleCounts(counts);
  };

  const filteredCustomers = customers.filter((customer) => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return true;
    }

    const firstName = customer.first_name?.toLowerCase() ?? "";
    const lastName = customer.last_name?.toLowerCase() ?? "";
    const fullName = `${firstName} ${lastName}`.trim();
    const email = customer.email?.toLowerCase() ?? "";
    const phone = customer.phone?.toLowerCase() ?? "";

    return (
      firstName.includes(term) ||
      lastName.includes(term) ||
      fullName.includes(term) ||
      email.includes(term) ||
      phone.includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="otg-manager-shell min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.push("/manager")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
              <p className="mt-1 text-slate-600">
                Search customer records and open each profile to manage details.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <BackToPortalButton />
            <Button onClick={() => router.push("/manager/jobs/new")}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Job
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search first name, last name, email, or phone"
                  className="pl-10"
                />
              </div>

              <div className="text-sm text-slate-500">
                Showing {filteredCustomers.length} of {customers.length} customers
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Users className="h-10 w-10 text-slate-300" />
              <div>
                <p className="font-medium text-slate-900">No customers found</p>
                <p className="text-sm text-slate-500">
                  Try adjusting the search to find a matching customer record.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCustomers.map((customer) => {
              const fullName =
                `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
                "Unnamed customer";

              return (
                <Card
                  key={customer.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/manager/customers/${customer.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-lg text-slate-900">{fullName}</CardTitle>
                        <p className="mt-1 text-sm text-slate-600">
                          {customer.email || "No email on file"}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {customer.tax_exempt && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Tax Exempt
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {vehicleCounts[customer.id] ?? 0}{" "}
                          {(vehicleCounts[customer.id] ?? 0) === 1 ? "vehicle" : "vehicles"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                      <div>
                        <span className="font-medium text-slate-700">Phone:</span>{" "}
                        {customer.phone || "No phone on file"}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Customer ID:</span>{" "}
                        <span className="font-mono text-xs">{customer.id.slice(0, 8)}</span>
                      </div>
                      <div className="text-blue-600 md:text-right">
                        Open customer details
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
