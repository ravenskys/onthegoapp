"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPostLoginRoute, getUserRoles, hasPortalAccess } from "@/lib/portal-auth";
import { getErrorMessage } from "@/lib/tech-inspection";
import { BackToPortalButton } from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { Textarea } from "@/components/ui/textarea";

type EditableServiceCatalogItem = {
  id?: string;
  serviceCode: string;
  serviceName: string;
  serviceDescription: string;
  category: string;
  defaultDurationMinutes: string;
  defaultPrice: string;
  defaultCost: string;
  defaultPartsCost: string;
  defaultPartsPrice: string;
  defaultPartsNotes: string;
  sortOrder: string;
  isActive: boolean;
  isBookableOnline: boolean;
  notes: string;
};

const createEmptyServiceCatalogItem = (): EditableServiceCatalogItem => ({
  serviceCode: "",
  serviceName: "",
  serviceDescription: "",
  category: "",
  defaultDurationMinutes: "",
  defaultPrice: "",
  defaultCost: "",
  defaultPartsCost: "",
  defaultPartsPrice: "",
  defaultPartsNotes: "",
  sortOrder: "0",
  isActive: true,
  isBookableOnline: true,
  notes: "",
});

const formatNumericField = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : String(value);

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingServiceIndex, setSavingServiceIndex] = useState<number | null>(null);
  const [authorized, setAuthorized] = useState(false);

  const [serviceTaxRate, setServiceTaxRate] = useState("0");
  const [partsTaxRate, setPartsTaxRate] = useState("0");
  const [serviceCatalogItems, setServiceCatalogItems] = useState<EditableServiceCatalogItem[]>([]);
  const [serviceCatalogMessage, setServiceCatalogMessage] = useState("");

  useEffect(() => {
    const loadPage = async () => {
      const { user, roles } = await getUserRoles();
      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      if (!hasPortalAccess(roles, "admin")) {
        window.location.href = getPostLoginRoute(roles);
        return;
      }

      setAuthorized(true);

      const { data: settingsData, error: settingsError } = await supabase
        .from("business_settings")
        .select("id, default_service_tax_rate, default_parts_tax_rate")
        .limit(1)
        .single();

      if (settingsError) {
        console.error(settingsError);
      } else {
        setServiceTaxRate(String(settingsData.default_service_tax_rate ?? 0));
        setPartsTaxRate(String(settingsData.default_parts_tax_rate ?? 0));
      }

      const { data: serviceCatalogData, error: serviceCatalogError } = await supabase
        .from("service_catalog")
        .select(
          "id, service_code, service_name, service_description, category, default_duration_minutes, default_price, default_cost, default_parts_cost, default_parts_price, default_parts_notes, is_active, is_bookable_online, sort_order, notes",
        )
        .order("sort_order", { ascending: true })
        .order("service_name", { ascending: true });

      if (serviceCatalogError) {
        console.error(serviceCatalogError);
      } else {
        setServiceCatalogItems(
          (serviceCatalogData || []).map((item) => ({
            id: item.id,
            serviceCode: item.service_code || "",
            serviceName: item.service_name || "",
            serviceDescription: item.service_description || "",
            category: item.category || "",
            defaultDurationMinutes: formatNumericField(item.default_duration_minutes),
            defaultPrice: formatNumericField(item.default_price),
            defaultCost: formatNumericField(item.default_cost),
            defaultPartsCost: formatNumericField(item.default_parts_cost),
            defaultPartsPrice: formatNumericField(item.default_parts_price),
            defaultPartsNotes: item.default_parts_notes || "",
            sortOrder: formatNumericField(item.sort_order ?? 0),
            isActive: Boolean(item.is_active),
            isBookableOnline: Boolean(item.is_bookable_online),
            notes: item.notes || "",
          })),
        );
      }

      setLoading(false);
    };

    loadPage();
  }, []);

  const handleSave = async () => {
    setSaving(true);

    try {
      const { data: existing, error: fetchError } = await supabase
        .from("business_settings")
        .select("id")
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from("business_settings")
        .update({
          default_service_tax_rate: Number(serviceTaxRate || "0"),
          default_parts_tax_rate: Number(partsTaxRate || "0"),
        })
        .eq("id", existing.id);

      if (updateError) throw updateError;

      alert("Settings saved.");
    } catch (error) {
      console.error(error);
      alert(`Failed to save settings: ${getErrorMessage(error, "Unknown error")}`);
    } finally {
      setSaving(false);
    }
  };

  const updateServiceCatalogItem = (
    index: number,
    field: keyof EditableServiceCatalogItem,
    value: string | boolean,
  ) => {
    setServiceCatalogItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const handleAddService = () => {
    setServiceCatalogItems((current) => [
      ...current,
      {
        ...createEmptyServiceCatalogItem(),
        sortOrder: String(current.length),
      },
    ]);
    setServiceCatalogMessage("");
  };

  const handleSaveService = async (index: number) => {
    const item = serviceCatalogItems[index];
    if (!item) return;

    if (!item.serviceName.trim()) {
      setServiceCatalogMessage("Service name is required before saving.");
      return;
    }

    setSavingServiceIndex(index);
    setServiceCatalogMessage("");

    try {
      const payload = {
        service_code: item.serviceCode.trim() || null,
        service_name: item.serviceName.trim(),
        service_description: item.serviceDescription.trim() || null,
        category: item.category.trim() || null,
        default_duration_minutes: item.defaultDurationMinutes.trim()
          ? Number(item.defaultDurationMinutes)
          : null,
        default_price: item.defaultPrice.trim() ? Number(item.defaultPrice) : null,
        default_cost: item.defaultCost.trim() ? Number(item.defaultCost) : null,
        default_parts_cost: item.defaultPartsCost.trim() ? Number(item.defaultPartsCost) : null,
        default_parts_price: item.defaultPartsPrice.trim() ? Number(item.defaultPartsPrice) : null,
        default_parts_notes: item.defaultPartsNotes.trim() || null,
        is_active: item.isActive,
        is_bookable_online: item.isBookableOnline,
        sort_order: item.sortOrder.trim() ? Number(item.sortOrder) : 0,
        notes: item.notes.trim() || null,
      };

      if (item.id) {
        const { error } = await supabase
          .from("service_catalog")
          .update(payload)
          .eq("id", item.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("service_catalog")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;

        setServiceCatalogItems((current) =>
          current.map((currentItem, itemIndex) =>
            itemIndex === index
              ? {
                  ...currentItem,
                  id: data.id,
                }
              : currentItem,
          ),
        );
      }

      setServiceCatalogMessage("Service catalog updated.");
    } catch (error) {
      setServiceCatalogMessage(
        `Failed to save service catalog item: ${getErrorMessage(error, "Unknown error")}`,
      );
    } finally {
      setSavingServiceIndex(null);
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
    <div className="otg-portal-dark min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Settings</h1>
            <p className="text-slate-600">
              Manage default tax settings for estimates and billing.
            </p>
          </div>

          <div className="w-full max-w-2xl space-y-4">
            <div className="flex justify-end">
              <PortalTopNav section="admin" />
            </div>
            <div className="flex justify-end">
              <BackToPortalButton />
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tax Defaults</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default Service Tax %</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={serviceTaxRate}
                onChange={(e) => setServiceTaxRate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Default Parts Tax %</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={partsTaxRate}
                onChange={(e) => setPartsTaxRate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Services Offered</CardTitle>
              <p className="text-sm text-slate-600">
                Admin can manage service names, labor time, pricing, and default parts/accounting details here.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={handleAddService}>
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {serviceCatalogItems.map((item, index) => (
              <div key={item.id || `service-catalog-${index}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Service Name</Label>
                    <Input
                      value={item.serviceName}
                      onChange={(e) => updateServiceCatalogItem(index, "serviceName", e.target.value)}
                      placeholder="Oil Change"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Code</Label>
                    <Input
                      value={item.serviceCode}
                      onChange={(e) => updateServiceCatalogItem(index, "serviceCode", e.target.value)}
                      placeholder="oil_change"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input
                      value={item.category}
                      onChange={(e) => updateServiceCatalogItem(index, "category", e.target.value)}
                      placeholder="Maintenance"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <Label>Description</Label>
                    <Textarea
                      value={item.serviceDescription}
                      onChange={(e) => updateServiceCatalogItem(index, "serviceDescription", e.target.value)}
                      placeholder="Describe the service offering"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Duration Minutes</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={item.defaultDurationMinutes}
                      onChange={(e) => updateServiceCatalogItem(index, "defaultDurationMinutes", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Labor Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.defaultPrice}
                      onChange={(e) => updateServiceCatalogItem(index, "defaultPrice", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Labor Cost</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.defaultCost}
                      onChange={(e) => updateServiceCatalogItem(index, "defaultCost", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Parts Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.defaultPartsPrice}
                      onChange={(e) => updateServiceCatalogItem(index, "defaultPartsPrice", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Parts Cost</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.defaultPartsCost}
                      onChange={(e) => updateServiceCatalogItem(index, "defaultPartsCost", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sort Order</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={item.sortOrder}
                      onChange={(e) => updateServiceCatalogItem(index, "sortOrder", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <Label>Default Parts Notes</Label>
                    <Textarea
                      value={item.defaultPartsNotes}
                      onChange={(e) => updateServiceCatalogItem(index, "defaultPartsNotes", e.target.value)}
                      placeholder="Common parts, accounting notes, supplier guidance, or kit details"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <Label>Internal Notes</Label>
                    <Textarea
                      value={item.notes}
                      onChange={(e) => updateServiceCatalogItem(index, "notes", e.target.value)}
                      placeholder="Internal service notes"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        onChange={(e) => updateServiceCatalogItem(index, "isActive", e.target.checked)}
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={item.isBookableOnline}
                        onChange={(e) => updateServiceCatalogItem(index, "isBookableOnline", e.target.checked)}
                      />
                      Bookable Online
                    </label>
                  </div>
                  <Button onClick={() => void handleSaveService(index)} disabled={savingServiceIndex === index}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingServiceIndex === index ? "Saving..." : "Save Service"}
                  </Button>
                </div>
              </div>
            ))}

            {serviceCatalogMessage ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {serviceCatalogMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
