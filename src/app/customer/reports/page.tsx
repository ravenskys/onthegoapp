"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, FileText } from "lucide-react";
import { CustomerPortalShell } from "@/components/customer/CustomerPortalShell";
import {
  buildVehicleLabel,
  CustomerPortalData,
  fetchCustomerPortalData,
  formatVehicleMiles,
  getSingleRelation,
  normalizeStoragePath,
} from "@/lib/customer-portal";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";

function CustomerReportsPageContent() {
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [selectedVehicleKey, setSelectedVehicleKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setSelectedVehicleKey(params.get("vehicle"));
  }, []);

  useEffect(() => {
    const loadPage = async () => {
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

        setPortalData(await fetchCustomerPortalData(user.id));
      } catch (error) {
        console.error("Customer reports load failed:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/customer/login";
  };

  const handleOpenPdf = async (pdfPath: string) => {
    try {
      const storagePath = normalizeStoragePath(pdfPath, "inspection-reports");
      if (!storagePath) return;

      const { data, error } = await supabase.storage
        .from("inspection-reports")
        .createSignedUrl(storagePath, 60);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Could not open PDF:", error);
    }
  };

  const handleDownloadPdf = async (reportId: string, pdfPath: string) => {
    try {
      setDownloadingReportId(reportId);
      const storagePath = normalizeStoragePath(pdfPath, "inspection-reports");
      if (!storagePath) return;

      const { data, error } = await supabase.storage
        .from("inspection-reports")
        .createSignedUrl(storagePath, 60);

      if (error) throw error;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = storagePath.split("/").pop() || "inspection-report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Could not download PDF:", error);
    } finally {
      setDownloadingReportId(null);
    }
  };

  const handleOpenPhoto = async (fileUrl: string | null | undefined) => {
    try {
      const storagePath = normalizeStoragePath(fileUrl, "inspection-photos");
      if (!storagePath) return;

      const { data, error } = await supabase.storage
        .from("inspection-photos")
        .createSignedUrl(storagePath, 300);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Could not open photo:", error);
    }
  };

  if (loading) {
    return <div className="otg-page"><div className="otg-container"><div className="otg-card p-8"><p className="otg-body">Loading reports...</p></div></div></div>;
  }

  const visibleGroups = selectedVehicleKey
    ? (portalData?.reportGroups.filter((group) => group.key === selectedVehicleKey) || [])
    : portalData?.reportGroups || [];
  const photosByInspection = portalData?.photosByInspection || {};

  return (
    <CustomerPortalShell
      title="Customer Report History"
      subtitle="Each vehicle keeps its own report history so customers can quickly open the right inspection record."
      onLogout={handleLogout}
    >
      <div className="otg-card p-4 sm:p-6">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Customer Report History</h2>
            <p className="mt-2 text-sm text-slate-600">
              Report history is grouped by vehicle so each car keeps its own timeline of completed inspections.
            </p>
            {selectedVehicleKey && visibleGroups[0]?.vehicle ? (
              <div className="mt-3 inline-flex rounded-full border border-lime-400/35 bg-lime-400 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-black">
                Viewing {buildVehicleLabel(visibleGroups[0].vehicle)}
              </div>
            ) : null}
          </div>
          <div className="self-start rounded-full border border-lime-400/35 bg-lime-400 px-4 py-2 text-sm font-semibold text-black sm:self-auto">
            {portalData?.reports.length || 0} report{(portalData?.reports.length || 0) === 1 ? "" : "s"}
          </div>
        </div>

        {selectedVehicleKey ? (
          <div className="mt-4">
            <a href="/customer/reports" className="otg-btn otg-btn-secondary">
              Show All Vehicles
            </a>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          {visibleGroups.length ? (
            visibleGroups.map((group) => (
              <div key={group.key} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(57,255,20,0.12),rgba(10,18,12,0.98))] px-5 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-xl font-semibold text-slate-900 sm:text-2xl">
                        {buildVehicleLabel(group.vehicle)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                        <span>{formatVehicleMiles(group.vehicle?.mileage)}</span>
                        <span>Plate: {group.vehicle?.license_plate || "-"}</span>
                        <span>VIN: {group.vehicle?.vin || "-"}</span>
                      </div>
                    </div>
                    <div className="rounded-full border border-lime-400/35 bg-lime-400 px-4 py-2 text-sm font-semibold text-black">
                      {group.reports.length} report{group.reports.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="space-y-5 px-5 py-5">
                  {group.reports.map((report) => {
                    const inspection = getSingleRelation(report.inspections);
                    const inspectionPhotos = inspection?.id
                      ? photosByInspection[inspection.id] || []
                      : [];

                    return (
                      <div key={report.id} className="rounded-[24px] border border-slate-200 bg-white/70 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="text-lg font-semibold text-slate-900">
                              Report from {new Date(report.created_at).toLocaleDateString()}
                            </div>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                              <span>Technician: {inspection?.tech_name || "-"}</span>
                              <span>Inspection ID: {inspection?.id || "-"}</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <button onClick={() => handleOpenPdf(report.pdf_path)} className="otg-btn otg-btn-primary sm:w-auto">
                              <FileText className="mr-2 h-4 w-4" />
                              View PDF
                            </button>

                            <button
                              onClick={() => handleDownloadPdf(report.id, report.pdf_path)}
                              disabled={downloadingReportId === report.id}
                              className="otg-btn otg-btn-secondary disabled:opacity-60 sm:w-auto"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {downloadingReportId === report.id ? "Downloading..." : "Download PDF"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Inspection Notes
                            </div>
                            <div className="mt-3 text-sm leading-7 text-slate-700">
                              {inspection?.notes || "No technician notes were attached to this report."}
                            </div>
                          </div>

                          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Photo Gallery
                            </div>
                            {inspectionPhotos.length > 0 ? (
                              <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                                {inspectionPhotos.slice(0, 4).map((photo) =>
                                  photo.signedUrl ? (
                                    <button
                                      key={photo.id}
                                      type="button"
                                      onClick={() => handleOpenPhoto(photo.file_path || photo.file_url)}
                                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/50"
                                    >
                                      <Image
                                        src={photo.signedUrl}
                                        alt={photo.photo_type || "Inspection photo"}
                                        width={480}
                                        height={224}
                                        unoptimized
                                        className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                      />
                                      <div className="p-2 text-left text-xs font-medium text-slate-600">
                                        {photo.photo_type || "Photo"}
                                      </div>
                                    </button>
                                  ) : null
                                )}
                              </div>
                            ) : (
                              <div className="mt-4 text-sm text-slate-600">
                                No inspection photos were attached to this report.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-slate-600">
              {selectedVehicleKey
                ? "No inspection reports are available for that vehicle yet."
                : "No inspection reports are available yet."}
            </div>
          )}
        </div>
      </div>
    </CustomerPortalShell>
  );
}

export default function CustomerReportsPage() {
  return <CustomerReportsPageContent />;
}
