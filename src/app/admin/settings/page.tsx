"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDown, ChevronRight, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/tech-inspection";
import { LABOR_SELL_USD_PER_HOUR } from "@/lib/labor-pricing";
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
  defaultPartName: string;
  defaultPartNumber: string;
  defaultPartQuantity: string;
  defaultPartSupplier: string;
  defaultPartsPrice: string;
  defaultPartsNotes: string;
  sortOrder: string;
  isActive: boolean;
  isBookableOnline: boolean;
  notes: string;
  defaultParts: EditableServiceCatalogPart[];
};

type EditableServiceCatalogPart = {
  id?: string;
  partName: string;
  defaultQuantity: string;
  notes: string;
  sortOrder: string;
};

const createEmptyServiceCatalogItem = (): EditableServiceCatalogItem => ({
  serviceCode: "",
  serviceName: "",
  serviceDescription: "",
  category: "",
  defaultDurationMinutes: "",
  defaultPrice: "",
  defaultPartName: "",
  defaultPartNumber: "",
  defaultPartQuantity: "1",
  defaultPartSupplier: "",
  defaultPartsPrice: "",
  defaultPartsNotes: "",
  sortOrder: "0",
  isActive: true,
  isBookableOnline: true,
  notes: "",
  defaultParts: [],
});

const createEmptyServiceCatalogPart = (): EditableServiceCatalogPart => ({
  partName: "",
  defaultQuantity: "1",
  notes: "",
  sortOrder: "0",
});

const formatNumericField = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : String(value);

const calculateLaborDefaultsFromDuration = (durationMinutes: string) => {
  const normalizedDuration = durationMinutes.trim();
  if (!normalizedDuration) {
    return { defaultPrice: "" };
  }

  const durationNumber = Number(normalizedDuration);
  if (!Number.isFinite(durationNumber) || durationNumber < 0) {
    return { defaultPrice: "" };
  }

  const hours = durationNumber / 60;
  return {
    defaultPrice: (hours * LABOR_SELL_USD_PER_HOUR).toFixed(2),
  };
};

const parseSortOrderNumber = (value: string) => {
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : 0;
};

/** Next sort order = max among loaded rows + 1, so manual adds don’t reuse 1, 2, 3 from older data. */
const getNextServiceSortOrder = (items: EditableServiceCatalogItem[]) =>
  items.reduce((max, item) => Math.max(max, parseSortOrderNumber(item.sortOrder)), 0) + 1;

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingServiceIndex, setSavingServiceIndex] = useState<number | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [serviceTaxRate, setServiceTaxRate] = useState("0");
  const [partsTaxRate, setPartsTaxRate] = useState("0");
  const [serviceCatalogItems, setServiceCatalogItems] = useState<EditableServiceCatalogItem[]>([]);
  const [serviceCatalogMessage, setServiceCatalogMessage] = useState("");
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [serviceCatalogLoading, setServiceCatalogLoading] = useState(false);

  const loadServiceCatalog = useCallback(async () => {
    setServiceCatalogLoading(true);
    try {
      const { data: serviceCatalogData, error: serviceCatalogError } = await supabase
        .from("service_catalog")
        .select(
          "id, service_code, service_name, service_description, category, default_duration_minutes, default_price, default_part_name, default_part_number, default_part_quantity, default_part_supplier, default_parts_price, default_parts_notes, is_active, is_bookable_online, sort_order, notes, service_catalog_parts(id, part_name, default_quantity, notes, sort_order)",
        )
        .order("sort_order", { ascending: true })
        .order("service_name", { ascending: true });

      if (serviceCatalogError) {
        console.error(serviceCatalogError);
        setServiceCatalogMessage(
          `Could not load service catalog: ${getErrorMessage(serviceCatalogError, "Unknown error")}`,
        );
        return;
      }

      setServiceCatalogItems(
        (serviceCatalogData || []).map((item) => ({
          id: item.id,
          serviceCode: item.service_code || "",
          serviceName: item.service_name || "",
          serviceDescription: item.service_description || "",
          category: item.category || "",
          defaultDurationMinutes: formatNumericField(item.default_duration_minutes),
          defaultPrice: formatNumericField(item.default_price),
          defaultPartName: item.default_part_name || "",
          defaultPartNumber: item.default_part_number || "",
          defaultPartQuantity: formatNumericField(item.default_part_quantity ?? 1),
            defaultPartSupplier: item.default_part_supplier || "",
            defaultPartsPrice: formatNumericField(item.default_parts_price),
          defaultPartsNotes: item.default_parts_notes || "",
          sortOrder: formatNumericField(item.sort_order ?? 0),
          isActive: Boolean(item.is_active),
          isBookableOnline: Boolean(item.is_bookable_online),
          notes: item.notes || "",
          defaultParts: (item.service_catalog_parts || [])
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((part) => ({
              id: part.id,
              partName: part.part_name || "",
              defaultQuantity: formatNumericField(part.default_quantity ?? 1),
              notes: part.notes || "",
              sortOrder: formatNumericField(part.sort_order ?? 0),
            })),
        })),
      );
      setServiceCatalogMessage("");
    } finally {
      setServiceCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadPage = async () => {
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

      await loadServiceCatalog();

      setLoading(false);
    };

    void loadPage();
  }, [loadServiceCatalog]);

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
          ? (() => {
              const nextItem = {
                ...item,
                [field]: value,
              };

              if (field === "defaultDurationMinutes" && typeof value === "string") {
                const laborDefaults = calculateLaborDefaultsFromDuration(value);
                return {
                  ...nextItem,
                  defaultPrice: laborDefaults.defaultPrice,
                };
              }

              return nextItem;
            })()
          : item,
      ),
    );
  };

  const updateServiceDefaultPart = (
    serviceIndex: number,
    partIndex: number,
    field: keyof EditableServiceCatalogPart,
    value: string,
  ) => {
    setServiceCatalogItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === serviceIndex
          ? {
              ...item,
              defaultParts: item.defaultParts.map((part, currentPartIndex) =>
                currentPartIndex === partIndex
                  ? {
                      ...part,
                      [field]: value,
                    }
                  : part,
              ),
            }
          : item,
      ),
    );
  };

  const handleAddServiceDefaultPart = (serviceIndex: number) => {
    setServiceCatalogItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === serviceIndex
          ? {
              ...item,
              defaultParts: [
                ...item.defaultParts,
                {
                  ...createEmptyServiceCatalogPart(),
                  sortOrder: String(item.defaultParts.length),
                },
              ],
            }
          : item,
      ),
    );
  };

  const handleRemoveServiceDefaultPart = (serviceIndex: number, partIndex: number) => {
    setServiceCatalogItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === serviceIndex
          ? {
              ...item,
              defaultParts: item.defaultParts.filter((_, currentPartIndex) => currentPartIndex !== partIndex),
            }
          : item,
      ),
    );
  };

  const handleAddService = () => {
    setServiceCatalogItems((current) => {
      const nextSort = getNextServiceSortOrder(current);
      return [
        ...current,
        {
          ...createEmptyServiceCatalogItem(),
          sortOrder: String(nextSort),
        },
      ];
    });
    setEditingServiceId(null);
    setExpandedServiceId(null);
    setServiceCatalogMessage("");
  };

  const handleDeleteService = async (index: number) => {
    const item = serviceCatalogItems[index];
    if (!item) return;

    const confirmed = window.confirm(
      item.id
        ? `Delete "${item.serviceName.trim() || "this service"}" from the catalog?`
        : "Remove this unsaved service?",
    );

    if (!confirmed) return;

    setSavingServiceIndex(index);
    setServiceCatalogMessage("");

    try {
      if (item.id) {
        const { error } = await supabase
          .from("service_catalog")
          .delete()
          .eq("id", item.id);

        if (error) throw error;
      }

      setServiceCatalogItems((current) =>
        current.filter((_, itemIndex) => itemIndex !== index),
      );

      if (item.id && editingServiceId === item.id) {
        setEditingServiceId(null);
      }
      if (item.id && expandedServiceId === item.id) {
        setExpandedServiceId(null);
      }

      setServiceCatalogMessage("Service removed from the catalog.");
    } catch (error) {
      setServiceCatalogMessage(
        `Failed to delete service catalog item: ${getErrorMessage(error, "Unknown error")}`,
      );
    } finally {
      setSavingServiceIndex(null);
    }
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
        default_part_name: item.defaultPartName.trim() || null,
        default_part_number: item.defaultPartNumber.trim() || null,
        default_part_quantity: item.defaultPartQuantity.trim()
          ? Number(item.defaultPartQuantity)
          : null,
        default_part_supplier: item.defaultPartSupplier.trim() || null,
        default_parts_price: item.defaultPartsPrice.trim() ? Number(item.defaultPartsPrice) : null,
        default_parts_notes: item.defaultPartsNotes.trim() || null,
        is_active: item.isActive,
        is_bookable_online: item.isBookableOnline,
        sort_order: item.sortOrder.trim() ? Number(item.sortOrder) : 0,
        notes: item.notes.trim() || null,
      };

      let serviceId = item.id;

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

        serviceId = data.id;

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

      if (!serviceId) {
        throw new Error("Unable to determine service id for saving default parts.");
      }

      const normalizedDefaultParts = item.defaultParts
        .map((part, partIndex) => ({
          part_name: part.partName.trim(),
          default_quantity: part.defaultQuantity.trim() ? Number(part.defaultQuantity) : 1,
          notes: part.notes.trim() || null,
          sort_order: part.sortOrder.trim() ? Number(part.sortOrder) : partIndex,
        }))
        .filter((part) => part.part_name);

      const { error: deletePartsError } = await supabase
        .from("service_catalog_parts")
        .delete()
        .eq("service_catalog_id", serviceId);

      if (deletePartsError) throw deletePartsError;

      if (normalizedDefaultParts.length > 0) {
        const { error: insertPartsError } = await supabase
          .from("service_catalog_parts")
          .insert(
            normalizedDefaultParts.map((part) => ({
              service_catalog_id: serviceId,
              ...part,
            })),
          );

        if (insertPartsError) throw insertPartsError;
      }

      setServiceCatalogMessage("Service catalog updated.");
      setEditingServiceId(null);
    } catch (error) {
      setServiceCatalogMessage(
        `Failed to save service catalog item: ${getErrorMessage(error, "Unknown error")}`,
      );
    } finally {
      setSavingServiceIndex(null);
    }
  };

  const normalizedServiceSearchQuery = serviceSearchQuery.trim().toLowerCase();

  const filteredServiceCatalogItems = serviceCatalogItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!normalizedServiceSearchQuery) return true;

      const searchableText = [
        item.serviceName,
        item.serviceCode,
        item.category,
        item.serviceDescription,
        item.defaultPartName,
        item.defaultPartNumber,
        item.defaultPartsNotes,
        ...item.defaultParts.map((part) => `${part.partName} ${part.notes}`),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedServiceSearchQuery);
    });

  if (loading) {
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
                Admin can manage service names, labor time, labor pricing, parts sell pricing, and default parts lists. Part costs from suppliers are not edited here yet.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadServiceCatalog()}
                disabled={serviceCatalogLoading}
                title="Reload the list from the database (use after migrations or edits made outside this page)"
              >
                {serviceCatalogLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Reload services
              </Button>
              <Button type="button" variant="outline" onClick={handleAddService}>
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {serviceCatalogItems.length === 0
                ? "No services are in the catalog yet. Use Add Service to create the first one."
                : `${serviceCatalogItems.length} service${serviceCatalogItems.length === 1 ? "" : "s"} currently loaded for editing.`}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-search">Search Services</Label>
              <Input
                id="service-search"
                value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)}
                placeholder="Search by service name, code, category, or parts"
              />
              {normalizedServiceSearchQuery ? (
                <p className="text-sm text-slate-600">
                  {filteredServiceCatalogItems.length} result
                  {filteredServiceCatalogItems.length === 1 ? "" : "s"} for{" "}
                  &quot;{serviceSearchQuery}&quot;.
                </p>
              ) : null}
            </div>

            {filteredServiceCatalogItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No services matched your search.
              </div>
            ) : null}

            {filteredServiceCatalogItems.map(({ item, index }) => (
              (() => {
                const isEditing = !item.id || editingServiceId === item.id;
                const isExpanded = Boolean(item.id && expandedServiceId === item.id);

                return isEditing ? (
                  <div key={item.id || `service-catalog-${index}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {item.id ? "Edit Service" : "New Service"}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {item.serviceName.trim() || `Service ${index + 1}`}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {item.serviceCode.trim() || "No service code yet"}
                        </div>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        {item.id ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditingServiceId(null)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleDeleteService(index)}
                          disabled={savingServiceIndex === index}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                        <Button onClick={() => void handleSaveService(index)} disabled={savingServiceIndex === index}>
                          <Save className="mr-2 h-4 w-4" />
                          {savingServiceIndex === index ? "Saving..." : "Save Service"}
                        </Button>
                      </div>
                    </div>

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
                        <Label>Default Part Name</Label>
                        <Input
                          value={item.defaultPartName}
                          onChange={(e) => updateServiceCatalogItem(index, "defaultPartName", e.target.value)}
                          placeholder="Oil Filter"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Part Number</Label>
                        <Input
                          value={item.defaultPartNumber}
                          onChange={(e) => updateServiceCatalogItem(index, "defaultPartNumber", e.target.value)}
                          placeholder="PH6607"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Part Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.defaultPartQuantity}
                          onChange={(e) => updateServiceCatalogItem(index, "defaultPartQuantity", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Part Supplier</Label>
                        <Input
                          value={item.defaultPartSupplier}
                          onChange={(e) => updateServiceCatalogItem(index, "defaultPartSupplier", e.target.value)}
                          placeholder="NAPA"
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
                      <div className="space-y-4 md:col-span-2 xl:col-span-3">
                        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <Label className="text-base font-semibold text-slate-900">Default Parts List</Label>
                              <p className="mt-1 text-sm text-slate-600">
                                Add the generic parts this service usually needs. Techs and managers can fill in exact part numbers and pricing later on the job.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleAddServiceDefaultPart(index)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Default Part
                            </Button>
                          </div>

                          {item.defaultParts.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                              No default parts added yet.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {item.defaultParts.map((part, partIndex) => (
                                <div
                                  key={part.id || `service-${index}-part-${partIndex}`}
                                  className="rounded-xl border border-slate-200 bg-white p-4"
                                >
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="space-y-2 xl:col-span-2">
                                      <Label>Part Name</Label>
                                      <Input
                                        value={part.partName}
                                        onChange={(e) =>
                                          updateServiceDefaultPart(index, partIndex, "partName", e.target.value)
                                        }
                                        placeholder="Brake Pads Set"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Default Quantity</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={part.defaultQuantity}
                                        onChange={(e) =>
                                          updateServiceDefaultPart(index, partIndex, "defaultQuantity", e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Sort Order</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={part.sortOrder}
                                        onChange={(e) =>
                                          updateServiceDefaultPart(index, partIndex, "sortOrder", e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2 md:col-span-2 xl:col-span-4">
                                      <Label>Notes</Label>
                                      <Textarea
                                        value={part.notes}
                                        onChange={(e) =>
                                          updateServiceDefaultPart(index, partIndex, "notes", e.target.value)
                                        }
                                        placeholder="Application notes, common kit guidance, or ordering reminders"
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-3 flex justify-end">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => handleRemoveServiceDefaultPart(index, partIndex)}
                                    >
                                      Remove Part
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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
                    </div>
                  </div>
                ) : (
                  <div
                    key={item.id || `service-catalog-${index}`}
                    className="rounded-2xl border border-slate-200 p-4 transition-colors hover:border-slate-300"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() =>
                        setExpandedServiceId((current) => (current === item.id ? null : item.id || null))
                      }
                    >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Saved Service
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {item.serviceName.trim() || `Service ${index + 1}`}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {item.serviceCode.trim() || "No service code yet"}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-700">
                          <div>Category: {item.category.trim() || "Not added"}</div>
                          <div>Duration: {item.defaultDurationMinutes.trim() ? `${item.defaultDurationMinutes} min` : "Not added"}</div>
                          <div>Labor Price: {item.defaultPrice.trim() ? `$${item.defaultPrice}` : "Not added"}</div>
                          <div>Default Parts: {item.defaultParts.length || (item.defaultPartName.trim() ? 1 : 0)}</div>
                        </div>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
                          <span className={`rounded-full px-3 py-1 ${item.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className={`rounded-full px-3 py-1 ${item.isBookableOnline ? "bg-lime-100 text-lime-900" : "bg-slate-200 text-slate-700"}`}>
                            {item.isBookableOnline ? "Bookable Online" : "Internal Only"}
                          </span>
                        </div>
                        <div className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                          {isExpanded ? (
                            <ChevronDown className="mr-2 h-4 w-4" />
                          ) : (
                            <ChevronRight className="mr-2 h-4 w-4" />
                          )}
                          {isExpanded ? "Hide Details" : "View Details"}
                        </div>
                      </div>
                    </div>
                    </button>
                    <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => setEditingServiceId(item.id || null)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleDeleteService(index)}
                          disabled={savingServiceIndex === index}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                    </div>
                    {isExpanded ? (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        {item.serviceDescription.trim() ? (
                          <div className="text-sm text-slate-700">
                            {item.serviceDescription.trim()}
                          </div>
                        ) : null}
                        <div className="mt-3 grid gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                          <div>Category: {item.category.trim() || "Not added"}</div>
                          <div>Duration: {item.defaultDurationMinutes.trim() ? `${item.defaultDurationMinutes} min` : "Not added"}</div>
                          <div>Labor Price: {item.defaultPrice.trim() ? `$${item.defaultPrice}` : "Not added"}</div>
                          <div>Default Part: {item.defaultPartName.trim() || "Not added"}</div>
                          <div>Part Number: {item.defaultPartNumber.trim() || "Not added"}</div>
                          <div>Part Qty: {item.defaultPartQuantity.trim() || "Not added"}</div>
                          <div>Part Supplier: {item.defaultPartSupplier.trim() || "Not added"}</div>
                          <div>Parts Price: {item.defaultPartsPrice.trim() ? `$${item.defaultPartsPrice}` : "Not added"}</div>
                          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5">Parts Notes: {item.defaultPartsNotes.trim() || "Not added"}</div>
                          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5">
                            Default Parts List:{" "}
                            {item.defaultParts.length > 0
                              ? item.defaultParts
                                  .map((part) =>
                                    `${part.partName.trim() || "Unnamed Part"} x${part.defaultQuantity.trim() || "1"}`,
                                  )
                                  .join(", ")
                              : "Not added"}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()
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
