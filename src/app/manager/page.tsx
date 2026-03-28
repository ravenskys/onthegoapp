"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ManagerPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [matchedCustomers, setMatchedCustomers] = useState<any[]>([]);
  const [allMatchedCustomers, setAllMatchedCustomers] = useState<any[]>([]);
  
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(allMatchedCustomers.length / PAGE_SIZE);

  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/customer/login";
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error || !data || data.length === 0) {
        window.location.href = "/customer/login";
        return;
      }

      const roleNames = data.map((r: any) => r.role);
      setRoles(roleNames);

      if (!roleNames.includes("manager") && !roleNames.includes("admin")) {
        if (roleNames.includes("technician")) {
          window.location.href = roleNames.length > 1 ? "/portal" : "/tech";
          return;
        }

        if (roleNames.includes("customer")) {
          window.location.href =
            roleNames.length > 1 ? "/portal" : "/customer/dashboard";
          return;
        }

        window.location.href = "/customer/login";
        return;
      }

      setAuthorized(true);
      setLoading(false);
    };

    checkAccess();
  }, []);

  const normalizePhone = (value: string) => value.replace(/\D/g, "");
  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const normalizePlate = (value: string) => value.trim().toUpperCase();
  const normalizeText = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");

  const getCustomerDisplayName = (customer: any) => {
    const fullName = [customer?.first_name, customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return fullName || "Unnamed Customer";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const handleOpenPdf = async (pdfPath: string) => {
    try {
      if (!pdfPath) {
        alert("No PDF path found for this report.");
        return;
      }

      const { data, error } = await supabase.storage
        .from("inspection-reports")
        .createSignedUrl(pdfPath, 60);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Could not open PDF:", error);
      alert("Could not open PDF.");
    }
  };

  const loadCustomerReports = async (customerRow: any) => {
    setCustomer(customerRow);
    setMatchedCustomers([]);
    setMessage("");

    const { data: reportRows, error: reportError } = await supabase
      .from("inspection_reports")
      .select(`
        id,
        pdf_path,
        created_at,
        inspections (
          id,
          created_at,
          tech_name,
          notes,
          inspection_summary,
          vehicles (
            year,
            make,
            model,
            mileage,
            vin,
            license_plate
          )
        )
      `)
      .eq("customer_id", customerRow.id)
      .order("created_at", { ascending: false });

    if (reportError) throw reportError;

    setReports(reportRows || []);

    if (!reportRows || reportRows.length === 0) {
      setMessage("Customer found, but no reports are available yet.");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setMessage("");
    setCustomer(null);
    setReports([]);
    setMatchedCustomers([]);
    setAllMatchedCustomers([]);
    setCurrentPage(0);
    setHasMoreMatches(false);

    try {
      const rawSearch = searchTerm.trim();

      if (!rawSearch) {
        setMessage("Enter a first name, last name, email, phone number, or license plate.");
        setSearching(false);
        return;
      }

      const normalizedEmailSearch = normalizeEmail(rawSearch);
      const normalizedPhoneSearch = normalizePhone(rawSearch);
      const normalizedPlateSearch = normalizePlate(rawSearch);
      const normalizedNameSearch = normalizeText(rawSearch);

      const { data: customerRows, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .limit(1000);

      if (customerError) throw customerError;

      const allCustomers = customerRows || [];

      const emailMatches = allCustomers.filter(
        (c: any) => normalizeEmail(c.email || "") === normalizedEmailSearch
      );

      if (emailMatches.length === 1) {
        await loadCustomerReports(emailMatches[0]);
        return;
      }

      if (emailMatches.length > 1) {
        setAllMatchedCustomers(emailMatches);
        setMatchedCustomers(
          emailMatches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
        );
        setHasMoreMatches(emailMatches.length > PAGE_SIZE);
        setMessage(
          emailMatches.length > PAGE_SIZE
            ? `Multiple customers match that email. Showing first ${PAGE_SIZE}. Select the correct customer or narrow the search.`
            : "Multiple customers match that email. Select the correct customer."
        );
        return;
      }

      const phoneMatches = allCustomers.filter((c: any) => {
        const customerPhone = normalizePhone(c.phone || "");
        return normalizedPhoneSearch.length > 0 && customerPhone === normalizedPhoneSearch;
      });

      if (phoneMatches.length === 1) {
        await loadCustomerReports(phoneMatches[0]);
        return;
      }

      if (phoneMatches.length > 1) {
        setAllMatchedCustomers(phoneMatches);
        setMatchedCustomers(
          phoneMatches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
        );
        setHasMoreMatches(phoneMatches.length > PAGE_SIZE);
        setMessage(
          phoneMatches.length > PAGE_SIZE
            ? `Multiple customers match that phone number. Showing first ${PAGE_SIZE}. Select the correct customer or narrow the search.`
            : "Multiple customers match that phone number. Select the correct customer."
        );
        return;
      }

      const { data: vehicleRows, error: vehicleError } = await supabase
        .from("vehicles")
        .select("customer_id, license_plate")
        .limit(2000);

      if (vehicleError) throw vehicleError;

      const plateMatches = (vehicleRows || []).filter(
        (v: any) => normalizePlate(v.license_plate || "") === normalizedPlateSearch
      );

      if (plateMatches.length === 1) {
        const { data: matchedCustomer, error: matchedCustomerError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", plateMatches[0].customer_id)
          .single();

        if (matchedCustomerError) throw matchedCustomerError;

        await loadCustomerReports(matchedCustomer);
        return;
      }

      if (plateMatches.length > 1) {
        const uniqueCustomerIds = [...new Set(plateMatches.map((v: any) => v.customer_id))];

        const matchedByPlate = allCustomers.filter((c: any) =>
          uniqueCustomerIds.includes(c.id)
        );

        setAllMatchedCustomers(matchedByPlate);
        setMatchedCustomers(
          matchedByPlate.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
        );
        setHasMoreMatches(matchedByPlate.length > PAGE_SIZE);
        setMessage(
          matchedByPlate.length > PAGE_SIZE
            ? `Multiple customers match that license plate. Showing first ${PAGE_SIZE}. Select the correct customer or narrow the search.`
            : "Multiple customers match that license plate. Select the correct customer."
        );
        return;
      }

      const nameMatches = allCustomers.filter((c: any) => {
        const firstName = normalizeText(c.first_name || "");
        const lastName = normalizeText(c.last_name || "");
        const fullName = normalizeText(`${c.first_name || ""} ${c.last_name || ""}`);

        const searchParts = normalizedNameSearch.split(" ").filter(Boolean);

        if (!normalizedNameSearch) return false;

        if (firstName === normalizedNameSearch) return true;
        if (lastName === normalizedNameSearch) return true;
        if (fullName === normalizedNameSearch) return true;
        if (fullName.includes(normalizedNameSearch)) return true;

        if (searchParts.length > 1) {
          return searchParts.every(
            (part) => firstName.includes(part) || lastName.includes(part)
          );
        }

        return firstName.includes(normalizedNameSearch) || lastName.includes(normalizedNameSearch);
      });

      if (nameMatches.length === 1) {
        await loadCustomerReports(nameMatches[0]);
        return;
      }

      if (nameMatches.length > 1) {
        setAllMatchedCustomers(nameMatches);
        setMatchedCustomers(
          nameMatches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
        );
        setHasMoreMatches(nameMatches.length > PAGE_SIZE);
        setMessage(nameMatches.length > PAGE_SIZE
            ? `Multiple customers match that name. Showing first ${PAGE_SIZE}. Select the correct customer or narrow the search.`
            : "Multiple customers match that name. Select the correct customer."
        );
        return;
      }

      setMessage("No customer found for that name, email, phone number, or license plate.");
    } catch (error: any) {
      console.error("Manager search failed:", error);
      setMessage(error?.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="otg-page">
        <div className="otg-container">
          <div className="otg-card p-8">
            <p className="otg-body">Loading manager dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="otg-page">
      <div className="otg-container space-y-6">
        <div className="otg-card p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="otg-brand-title-black">On The Go Maintenance</div>
              <h1 className="otg-page-title">Manager Dashboard</h1>
              <p className="otg-body mt-2">
                Review customer history, inspection reports, and service follow-up.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {roles.length > 1 && (
                <a href="/portal" className="otg-btn otg-btn-secondary">
                  Portal Home
                </a>
              )}

              <button onClick={handleLogout} className="otg-btn otg-btn-secondary">
                Log Out
              </button>
            </div>
          </div>
        </div>

        <div className="otg-card p-8">
          <h2 className="otg-section-title">Customer Search</h2>
          <p className="otg-body mt-2">
            Search by customer first name, last name, email, phone number, or vehicle license plate.
          </p>

          <form onSubmit={handleSearch} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="otg-label">Search</label>
              <input
                type="text"
                required
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="otg-input"
                placeholder="John, John Smith, customer@email.com, (555) 555-5555, or plate number ABC123"
              />
            </div>

            <button
              type="submit"
              disabled={searching}
              className="otg-btn otg-btn-primary disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}

          {matchedCustomers.length > 0 && (
            <div className="mt-6 space-y-3">
              {matchedCustomers.map((matchedCustomer) => (
                <button
                  key={matchedCustomer.id}
                  type="button"
                  onClick={() => loadCustomerReports(matchedCustomer)}
                  className="flex w-full flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                >
                  <div className="font-semibold text-slate-900">
                    {getCustomerDisplayName(matchedCustomer)}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Email: {matchedCustomer.email || "-"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Phone: {matchedCustomer.phone || "-"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Customer ID: {matchedCustomer.id}
                  </div>
                </button>
              ))}

             {hasMoreMatches && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">
                    Showing the first {PAGE_SIZE} matches. Narrow the search to see fewer results.
                  </p>

                  <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-500">
                      Page {currentPage + 1} of {totalPages}
                    </p>

                    <button
                      type="button"
                      disabled={currentPage === 0}
                      onClick={() => {
                        const prevPage = Math.max(currentPage - 1, 0);
                        setCurrentPage(prevPage);
                        setMatchedCustomers(
                          allMatchedCustomers.slice(prevPage * PAGE_SIZE, (prevPage + 1) * PAGE_SIZE)
                        );
                      }}
                      className="otg-btn otg-btn-secondary disabled:opacity-50"
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => {
                        const nextPage = Math.min(currentPage + 1, totalPages - 1);
                        setCurrentPage(nextPage);
                        setMatchedCustomers(
                          allMatchedCustomers.slice(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE)
                        );
                      }}
                      className="otg-btn otg-btn-secondary disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {customer && (
          <div className="otg-card p-8">
            <h2 className="otg-section-title">Customer</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <div>
                <span className="font-semibold">Name:</span> {getCustomerDisplayName(customer)}
              </div>
              <div><span className="font-semibold">Email:</span> {customer.email || "-"}</div>
              <div><span className="font-semibold">Phone:</span> {customer.phone || "-"}</div>
              <div><span className="font-semibold">Customer ID:</span> {customer.id}</div>
            </div>
          </div>
        )}

        {reports.length > 0 && (
          <div className="otg-card p-8">
            <h2 className="otg-section-title">Inspection Reports</h2>
            <div className="mt-6 space-y-4">
              {reports.map((report) => {
                const inspection = Array.isArray(report.inspections)
                  ? report.inspections[0]
                  : report.inspections;

                const vehicle =
                  inspection?.vehicles && Array.isArray(inspection.vehicles)
                    ? inspection.vehicles[0]
                    : inspection?.vehicles;

                return (
                  <div
                    key={report.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">
                          {[vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Report Date: {new Date(report.created_at).toLocaleDateString()}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Technician: {inspection?.tech_name || "-"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          VIN: {vehicle?.vin || "-"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Plate: {vehicle?.license_plate || "-"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Mileage: {vehicle?.mileage || "-"}
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenPdf(report.pdf_path)}
                        className="otg-btn otg-btn-primary"
                      >
                        View PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}