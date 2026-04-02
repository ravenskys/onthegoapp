"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const [serviceTaxRate, setServiceTaxRate] = useState("0");
  const [partsTaxRate, setPartsTaxRate] = useState("0");

  useEffect(() => {
    const loadPage = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/customer/login";
        return;
      }

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (rolesError) {
        console.error(rolesError);
        return;
      }

      const isAdmin = roles?.some((r) => r.role === "admin");

      if (!isAdmin) {
        window.location.href = "/portal";
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
    } catch (error: any) {
      console.error(error);
      alert(`Failed to save settings: ${error.message || "Unknown error"}`);
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Settings</h1>
          <p className="text-slate-600">
            Manage default tax settings for estimates and billing.
          </p>
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
      </div>
    </div>
  );
}