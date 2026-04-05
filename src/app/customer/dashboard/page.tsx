"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatPhoneNumber } from "@/lib/input-formatters";
import { CustomerContactFields } from "@/components/customer/CustomerContactFields";
import { workflowStepLabels } from "@/lib/inspection-workflow";
import { getErrorMessage } from "@/lib/tech-inspection";
import { getPostLoginRoute, getUserRoles } from "@/lib/portal-auth";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BackToPortalButton } from "@/components/portal/BackToPortalButton";

const normalizeStoragePath = (value: string | null | undefined, bucket: string) => {
  if (!value) return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const publicPrefix = `/storage/v1/object/public/${bucket}/`;
  const signPrefix = `/storage/v1/object/sign/${bucket}/`;

  try {
    const parsedUrl = new URL(trimmedValue);

    if (parsedUrl.pathname.includes(publicPrefix)) {
      return decodeURIComponent(parsedUrl.pathname.split(publicPrefix)[1] || "");
    }

    if (parsedUrl.pathname.includes(signPrefix)) {
      return decodeURIComponent(parsedUrl.pathname.split(signPrefix)[1] || "");
    }
  } catch {
    return trimmedValue;
  }

  return trimmedValue;
};

export default function CustomerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [photosByInspection, setPhotosByInspection] = useState<Record<string, any[]>>({});
  const [latestInspection, setLatestInspection] = useState<any>(null);

  const [accountFirstName, setAccountFirstName] = useState("");
  const [accountLastName, setAccountLastName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const { user, roles: roleNames } = await getUserRoles();
        if (!user) {
          window.location.href = "/customer/login";
          return;
        }

        if (roleNames.length === 0) {
          setLoading(false);
          return;
        }

        if (!roleNames.includes("customer")) {
          window.location.href = getPostLoginRoute(roleNames);
          return;
        }

        const { data: customerRow, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("auth_user_id", user.id)
          .single();

        if (customerError || !customerRow) {
          setLoading(false);
          return;
        }

        setCustomer(customerRow);
        setAccountFirstName(customerRow.first_name || "");
        setAccountLastName(customerRow.last_name || "");
        setAccountPhone(customerRow.phone || "");

        const { data: inspectionRows, error: inspectionError } = await supabase
          .from("inspections")
          .select(`
            id,
            created_at,
            tech_name,
            inspection_summary,
            vehicles (
              year,
              make,
              model,
              mileage,
              vin
            )
          `)
          .eq("customer_id", customerRow.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (inspectionError) throw inspectionError;

        if (inspectionRows && inspectionRows.length > 0) {
          setLatestInspection(inspectionRows[0]);
        } else {
          setLatestInspection(null);
        }

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
                vin
              )
            )
          `)
          .eq("customer_id", customerRow.id)
          .order("created_at", { ascending: false });

        if (reportError) throw reportError;

        setReports(reportRows || []);

        const inspectionIds = (reportRows || [])
          .map((report: any) => {
            const inspection = Array.isArray(report.inspections)
              ? report.inspections[0]
              : report.inspections;

            return inspection?.id;
          })
          .filter(Boolean);

        if (inspectionIds.length) {
          const { data: photoRows, error: photoError } = await supabase
            .from("inspection_photos")
            .select("*")
            .in("inspection_id", inspectionIds);

          if (photoError) throw photoError;

          const photosWithUrls = await Promise.all(
            (photoRows || []).map(async (photo: any) => {
              const storagePath = normalizeStoragePath(photo.file_url, "inspection-photos");

              if (!storagePath) {
                return { ...photo, signedUrl: null };
              }

              const { data, error } = await supabase.storage
                .from("inspection-photos")
                .createSignedUrl(storagePath, 60);

              if (error) {
                return { ...photo, signedUrl: null };
              }

              return { ...photo, file_path: storagePath, signedUrl: data.signedUrl };
            })
          );

          const groupedPhotos = photosWithUrls.reduce(
            (acc: Record<string, any[]>, photo: any) => {
              if (!acc[photo.inspection_id]) {
                acc[photo.inspection_id] = [];
              }
              acc[photo.inspection_id].push(photo);
              return acc;
            },
            {}
          );

          setPhotosByInspection(groupedPhotos);
        } else {
          setPhotosByInspection({});
        }
      } catch (error) {
        console.error("Dashboard load failed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const handleOpenPdf = async (pdfPath: string) => {
    try {
      const storagePath = normalizeStoragePath(pdfPath, "inspection-reports");

      if (!storagePath) {
        alert("No PDF path found for this report.");
        return;
      }

      const { data, error } = await supabase.storage
        .from("inspection-reports")
        .createSignedUrl(storagePath, 60);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Could not open PDF:", error);
      alert("Could not open PDF.");
    }
  };

  const handleOpenPhoto = async (fileUrl: string) => {
    try {
      const storagePath = normalizeStoragePath(fileUrl, "inspection-photos");

      if (!storagePath) {
        alert("No photo found.");
        return;
      }

      const { data, error } = await supabase.storage
        .from("inspection-photos")
        .createSignedUrl(storagePath, 300);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Could not open photo:", error);
      alert("Could not open photo.");
    }
  };

  const handleSaveAccountInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer?.id) return;

    setSavingAccount(true);
    setAccountMessage("");

    try {
      const trimmedFirstName = accountFirstName.trim();
      const trimmedLastName = accountLastName.trim();
      const trimmedPhone = formatPhoneNumber(accountPhone).trim();

      const { error } = await supabase
        .from("customers")
        .update({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone: trimmedPhone,
        })
        .eq("id", customer.id);

      if (error) throw error;

      setCustomer((prev: any) =>
        prev
          ? {
              ...prev,
              first_name: trimmedFirstName,
              last_name: trimmedLastName,
              phone: trimmedPhone,
            }
          : prev
      );

      setAccountMessage("Account information updated.");
    } catch (error) {
      setAccountMessage(getErrorMessage(error, "Failed to update account information."));
    } finally {
      setSavingAccount(false);
    }
  };

  const latestWorkflowSteps = latestInspection?.inspection_summary?.workflow_steps || {};
  const workflowTotal =
    latestInspection?.inspection_summary?.workflow_total_count ||
    Object.keys(workflowStepLabels).length;
  const workflowCompleted =
    latestInspection?.inspection_summary?.workflow_completed_count ||
    Object.values(latestWorkflowSteps).filter(Boolean).length;

  if (loading) {
    return (
      <div className="otg-page">
        <div className="otg-container">
          <div className="otg-card p-8">
            <p className="otg-body">Loading customer portal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="otg-page">
        <div className="otg-container max-w-3xl">
          <div className="otg-card p-8">
            <h1 className="otg-section-title">Customer account not linked yet</h1>
            <p className="otg-body mt-3">
              Your login worked, but your portal account has not been connected to a customer record yet.
            </p>
            <p className="otg-muted mt-2">
              Once we connect your customer record, your inspection reports will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="otg-page">
      <div className="otg-container space-y-6">
        <div className="otg-card p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <BrandLogo priority />
              <h1 className="otg-page-title">Customer Portal</h1>
              <p className="otg-body mt-2">
                Welcome, {[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer"}.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <BackToPortalButton className="otg-btn otg-btn-secondary shadow-none" />
              <button
                onClick={handleLogout}
                className="otg-btn otg-btn-secondary"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>

        <div className="otg-card p-8">
          <h2 className="otg-section-title">Account Information</h2>
          <p className="otg-body mt-2">
            Update your contact information connected to your service records.
          </p>

          <form onSubmit={handleSaveAccountInfo} className="mt-6 space-y-4">
            <CustomerContactFields
              firstName={accountFirstName}
              lastName={accountLastName}
              phone={accountPhone}
              setFirstName={setAccountFirstName}
              setLastName={setAccountLastName}
              setPhone={(value) => setAccountPhone(formatPhoneNumber(value))}
            />

            <button
              type="submit"
              disabled={savingAccount}
              className="otg-btn otg-btn-primary disabled:opacity-50"
            >
              {savingAccount ? "Saving..." : "Save Account Information"}
            </button>
          </form>

          {accountMessage && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {accountMessage}
            </div>
          )}
        </div>

        <div className="otg-card p-8">
          <h2 className="otg-section-title">Current Service Progress</h2>
          <p className="otg-body mt-2">
            Track the latest technician steps as your vehicle moves through the inspection.
          </p>

          {latestInspection ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {(() => {
                        const vehicle =
                          latestInspection?.vehicles && Array.isArray(latestInspection.vehicles)
                            ? latestInspection.vehicles[0]
                            : latestInspection?.vehicles;

                        return (
                          [vehicle?.year, vehicle?.make, vehicle?.model]
                            .filter(Boolean)
                            .join(" ") || "Vehicle"
                        );
                      })()}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Last updated: {new Date(latestInspection.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Technician: {latestInspection.tech_name || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    {workflowCompleted} of {workflowTotal} steps complete
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(workflowStepLabels).map(([stepKey, label]) => {
                  const complete = Boolean(latestWorkflowSteps?.[stepKey]);

                  return (
                    <div
                      key={stepKey}
                      className={`rounded-2xl border p-4 text-sm ${
                        complete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      <div className="font-semibold">{label}</div>
                      <div className="mt-1">
                        {complete ? "Completed" : "Waiting on this step"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
              No live service progress is available yet.
            </div>
          )}
        </div>

        <div className="otg-card p-8">
          <h2 className="otg-section-title">Inspection Reports</h2>
          <p className="otg-body mt-2">
            View and download your completed vehicle inspection reports.
          </p>

          <div className="mt-6 space-y-4">
            {reports.length ? (
              reports.map((report) => {
                const inspection = Array.isArray(report.inspections)
                  ? report.inspections[0]
                  : report.inspections;

                const vehicle =
                  inspection?.vehicles && Array.isArray(inspection.vehicles)
                    ? inspection.vehicles[0]
                    : inspection?.vehicles;

                const inspectionPhotos = inspection?.id
                  ? photosByInspection[inspection.id] || []
                  : [];

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
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleOpenPdf(report.pdf_path)}
                          className="otg-btn otg-btn-primary"
                        >
                          View PDF
                        </button>

                        <button
                          onClick={() => handleOpenPdf(report.pdf_path)}
                          className="otg-btn otg-btn-secondary"
                        >
                          Download PDF
                        </button>
                      </div>
                    </div>

                    {inspectionPhotos.length > 0 && (
                      <div className="mt-5">
                        <h3 className="otg-card-title">Inspection Photos</h3>
                        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {inspectionPhotos.map((photo: any) =>
                            photo.signedUrl ? (
                              <a
                                key={photo.id}
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleOpenPhoto(photo.file_path || photo.file_url);
                                }}
                                className="block overflow-hidden rounded-xl border border-slate-200 bg-white"
                              >
                                <img
                                  src={photo.signedUrl}
                                  alt={photo.photo_type || "Inspection photo"}
                                  className="h-32 w-full object-cover"
                                />
                                <div className="p-2 text-xs text-slate-600">
                                  {photo.photo_type || "Photo"}
                                </div>
                              </a>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
                No inspection reports are available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
