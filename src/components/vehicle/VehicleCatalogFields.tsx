"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MAX_MODEL_YEAR } from "@/lib/input-formatters";
import { cn } from "@/lib/utils";
import { normalizeVin } from "@/lib/input-formatters";
import { getLicensePlateInputWarning, getVinInputWarning } from "@/lib/input-validation-feedback";
import { mapNhtsaDecodeToVehicleFields } from "@/lib/vin";
import {
  findVehicleCatalogMake,
  getVehicleCatalogEngines,
  getVehicleCatalogModels,
  vehicleMakes,
} from "@/lib/vehicleCatalog";

type VehicleCatalogFieldsProps = {
  make: string;
  model: string;
  engineSize: string;
  licensePlate: string;
  vin: string;
  year: string;
  useCustomMake: boolean;
  useCustomModel: boolean;
  useCustomEngineSize: boolean;
  normalizeYear: (value: string) => string;
  normalizeVin: (value: string) => string;
  normalizeLicensePlate: (value: string) => string;
  setMake: (value: string) => void;
  setModel: (value: string) => void;
  setEngineSize: (value: string) => void;
  setLicensePlate: (value: string) => void;
  setVin: (value: string) => void;
  setYear: (value: string) => void;
  setUseCustomMake: (updater: (prev: boolean) => boolean) => void;
  setUseCustomModel: (updater: (prev: boolean) => boolean) => void;
  setUseCustomEngineSize: (updater: (prev: boolean) => boolean) => void;
  makeListId: string;
  modelListId: string;
  engineListId: string;
  className?: string;
  onMakeCommit?: (value: string) => void;
  onModelCommit?: (value: string) => void;
  onEngineCommit?: (value: string) => void;
  onPlateCommit?: (value: string) => void;
  onVinCommit?: (value: string) => void;
  onYearCommit?: (value: string) => void;
  /** When false, hides the helper line under the license plate field. Defaults to true. */
  showLicensePlateHint?: boolean;
  /** When true, shows "Lookup VIN" to decode and autofill year/make/model (NHTSA). Default true. */
  enableVinLookup?: boolean;
};

type SearchableOption = {
  label: string;
  value: string;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  onSelect: (value: string) => void;
  allowCustom?: boolean;
  customActionLabel?: string;
  onCustomSelect?: (value: string) => void;
};

function SearchableSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  onSelect,
  allowCustom = false,
  customActionLabel = "Use as custom value",
  onCustomSelect,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = options.find((option) => option.value === value);
  const trimmedQuery = query.trim();
  const hasExactMatch = options.some(
    (option) =>
      option.label.toLowerCase() === trimmedQuery.toLowerCase() ||
      option.value.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCustomOption =
    allowCustom &&
    Boolean(trimmedQuery) &&
    !hasExactMatch &&
    typeof onCustomSelect === "function";

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="otg-vehicle-combobox h-10 w-full justify-between border-slate-300 bg-white px-3 font-normal text-slate-900 hover:bg-slate-50"
        >
          <span className={cn("truncate", !selectedOption && "text-slate-500 otg-vehicle-combobox-placeholder")}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="otg-vehicle-combobox-icon h-4 w-4 shrink-0 text-slate-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="otg-vehicle-combobox-menu w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command className="otg-vehicle-combobox-command">
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.value}`}
                onSelect={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span>{option.label}</span>
              </CommandItem>
            ))}
            {showCustomOption ? (
              <CommandItem
                value={`custom ${trimmedQuery}`}
                onSelect={() => {
                  onCustomSelect?.(trimmedQuery);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="font-medium">{customActionLabel}:</span>
                <span className="truncate">{trimmedQuery}</span>
              </CommandItem>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function VehicleCatalogFields({
  make,
  model,
  engineSize,
  licensePlate,
  vin,
  year,
  useCustomMake,
  useCustomModel,
  useCustomEngineSize,
  normalizeYear,
  normalizeVin,
  normalizeLicensePlate,
  setMake,
  setModel,
  setEngineSize,
  setLicensePlate,
  setVin,
  setYear,
  setUseCustomMake,
  setUseCustomModel,
  setUseCustomEngineSize,
  engineListId,
  className = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
  onMakeCommit,
  onModelCommit,
  onEngineCommit,
  onPlateCommit,
  onVinCommit,
  onYearCommit,
  showLicensePlateHint = true,
  enableVinLookup = true,
}: VehicleCatalogFieldsProps) {
  const [vinLookupLoading, setVinLookupLoading] = useState(false);
  const [vinLookupMessage, setVinLookupMessage] = useState<string | null>(null);
  const [vinFormatWarning, setVinFormatWarning] = useState<string | null>(null);
  const [licensePlateFormatWarning, setLicensePlateFormatWarning] = useState<string | null>(null);
  const yearOptions = useMemo(
    () =>
      Array.from({ length: MAX_MODEL_YEAR - 1984 }, (_, index) => {
        const yearValue = String(MAX_MODEL_YEAR - index);
        return { label: yearValue, value: yearValue };
      }),
    []
  );

  const makeOptions = useMemo(
    () => vehicleMakes.map((catalogMake) => ({ label: catalogMake, value: catalogMake })),
    []
  );

  const knownModelsForMake = (() => {
    const exactMake = findVehicleCatalogMake(make);
    return exactMake ? getVehicleCatalogModels(exactMake, year) : [];
  })();

  const knownEngineSizesForModel = (() => {
    const exactMake = findVehicleCatalogMake(make);
    return exactMake ? getVehicleCatalogEngines(exactMake, model, year) : [];
  })();

  const modelOptions = useMemo(
    () => knownModelsForMake.map((catalogModel) => ({ label: catalogModel, value: catalogModel })),
    [knownModelsForMake]
  );

  const handleMakeChange = (value: string) => {
    const matchedMake = findVehicleCatalogMake(value);

    setUseCustomMake(() => false);
    setUseCustomModel(() => false);
    setUseCustomEngineSize(() => false);
    setMake(matchedMake ?? value);
    setModel("");
    setEngineSize("");
  };

  const handleModelChange = (value: string) => {
    setUseCustomModel(() => false);
    setUseCustomEngineSize(() => false);
    setModel(value);
    setEngineSize("");
  };

  const handleYearChange = (value: string) => {
    const normalizedValue = normalizeYear(value);
    const matchingMake = findVehicleCatalogMake(make);
    const availableModels = matchingMake ? getVehicleCatalogModels(matchingMake, normalizedValue) : [];
    const selectedModelIsStillValid = availableModels.some(
      (catalogModel) => catalogModel.toLowerCase() === String(model || "").trim().toLowerCase()
    );
    const availableEngines =
      matchingMake && selectedModelIsStillValid
        ? getVehicleCatalogEngines(matchingMake, model, normalizedValue)
        : [];
    const selectedEngineIsStillValid = availableEngines.some(
      (catalogEngine) =>
        catalogEngine.toLowerCase() === String(engineSize || "").trim().toLowerCase()
    );

    setYear(normalizedValue);

    if (!selectedModelIsStillValid) {
      setUseCustomModel(() => false);
      setUseCustomEngineSize(() => false);
      setModel("");
      setEngineSize("");
    } else if (!selectedEngineIsStillValid) {
      setUseCustomEngineSize(() => false);
      setEngineSize("");
    }

    onYearCommit?.(normalizedValue);
  };

  const handleEngineSizeChange = (value: string) => {
    if (value === "Other") {
      setUseCustomEngineSize(() => true);
      setEngineSize("");
      return;
    }

    setUseCustomEngineSize(() => false);
    setEngineSize(value);
  };

  const handleVinLookup = async () => {
    const normalized = normalizeVin(vin);
    if (normalized.length !== 17) {
      setVinLookupMessage("Enter all 17 characters before lookup.");
      return;
    }

    setVinLookupLoading(true);
    setVinLookupMessage(null);

    try {
      const res = await fetch("/api/vehicles/decode-vin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: normalized }),
      });

      const data = (await res.json()) as {
        error?: string;
        modelYear?: string;
        make?: string;
        model?: string;
        checkDigitValid?: boolean;
      };

      if (!res.ok) {
        setVinLookupMessage(data.error || "Could not decode VIN.");
        return;
      }

      setVin(normalized);
      onVinCommit?.(normalized);

      const applied = mapNhtsaDecodeToVehicleFields(
        data.modelYear ?? "",
        data.make ?? "",
        data.model ?? "",
      );

      handleYearChange(applied.year);

      if (!applied.useCustomMake) {
        handleMakeChange(applied.make);
      } else {
        setUseCustomMake(() => true);
        setUseCustomModel(() => false);
        setUseCustomEngineSize(() => false);
        setMake(applied.make);
        setModel("");
        setEngineSize("");
      }

      if (!applied.useCustomModel) {
        handleModelChange(applied.model);
      } else {
        setUseCustomModel(() => true);
        setUseCustomEngineSize(() => false);
        setModel(applied.model);
        setEngineSize("");
      }

      onMakeCommit?.(applied.make);
      onModelCommit?.(applied.model);

      const warnCheck = data.checkDigitValid === false;
      setVinLookupMessage(
        warnCheck
          ? "Year, make, and model filled from VIN. Note: check digit did not verify—confirm the VIN if unsure."
          : "Year, make, and model filled from VIN.",
      );
    } catch {
      setVinLookupMessage("Network error. Try again.");
    } finally {
      setVinLookupLoading(false);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label>Year</Label>
        <SearchableSelect
          value={year}
          options={yearOptions}
          placeholder="Select year"
          searchPlaceholder="Search year..."
          emptyMessage="No matching year found."
          onSelect={handleYearChange}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Make</Label>
          <button
            type="button"
            onClick={() => {
              setUseCustomMake((prev) => {
                const nextValue = !prev;
                if (!nextValue) setMake("");
                return nextValue;
              });
            }}
            className="text-sm font-medium text-blue-600"
          >
            {useCustomMake ? "Use catalog list" : "Other make"}
          </button>
        </div>
        {useCustomMake ? (
          <Input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            onBlur={(e) => onMakeCommit?.(e.target.value)}
            placeholder="Enter custom make"
          />
        ) : (
          <SearchableSelect
            value={make}
            options={makeOptions}
            placeholder="Search or select make"
            searchPlaceholder="Search make..."
            emptyMessage="No matching make found."
            allowCustom
            customActionLabel="Use custom make"
            onSelect={(value) => {
              handleMakeChange(value);
              onMakeCommit?.(value);
            }}
            onCustomSelect={(value) => {
              setUseCustomMake(() => true);
              setUseCustomModel(() => false);
              setUseCustomEngineSize(() => false);
              setMake(value);
              setModel("");
              setEngineSize("");
              onMakeCommit?.(value);
            }}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Model</Label>
          <button
            type="button"
            onClick={() => {
              setUseCustomModel((prev) => {
                const nextValue = !prev;
                if (!nextValue) setModel("");
                return nextValue;
              });
            }}
            className="text-sm font-medium text-blue-600"
          >
            {useCustomModel ? "Use catalog list" : "Other model"}
          </button>
        </div>
        {useCustomModel ? (
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onBlur={(e) => onModelCommit?.(e.target.value)}
            placeholder="Enter custom model"
          />
        ) : (
          <SearchableSelect
            value={model}
            options={modelOptions}
            placeholder={
              knownModelsForMake.length
                ? "Search or select model"
                : year
                  ? "No catalog models for that year"
                  : "Choose a make first or use Other model"
            }
            searchPlaceholder="Search model..."
            emptyMessage="No matching model found."
            disabled={!String(make || "").trim()}
            allowCustom
            customActionLabel="Use custom model"
            onSelect={(value) => {
              handleModelChange(value);
              onModelCommit?.(value);
            }}
            onCustomSelect={(value) => {
              setUseCustomModel(() => true);
              setUseCustomEngineSize(() => false);
              setModel(value);
              setEngineSize("");
              onModelCommit?.(value);
            }}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Engine Size</Label>
          <button
            type="button"
            onClick={() => {
              setUseCustomEngineSize((prev) => {
                const nextValue = !prev;
                if (!nextValue) setEngineSize("");
                return nextValue;
              });
            }}
            className="text-sm font-medium text-blue-600"
          >
            {useCustomEngineSize ? "Use catalog list" : "Other engine"}
          </button>
        </div>
        {useCustomEngineSize ? (
          <Input
            value={engineSize}
            onChange={(e) => setEngineSize(e.target.value)}
            onBlur={(e) => onEngineCommit?.(e.target.value)}
            placeholder="Enter custom engine size"
          />
        ) : (
          <>
            <Input
              list={engineListId}
              value={engineSize}
              onChange={(e) => handleEngineSizeChange(e.target.value)}
              onBlur={(e) => {
                handleEngineSizeChange(e.target.value);
                onEngineCommit?.(e.target.value);
              }}
              placeholder={
                knownEngineSizesForModel.length
                  ? "Search or select engine size"
                  : year
                    ? "No catalog engines for that year"
                    : "Choose a model first or use Other engine"
              }
              disabled={!String(model || "").trim()}
            />
            <datalist id={engineListId}>
              {knownEngineSizesForModel.map((catalogEngine) => (
                <option key={catalogEngine} value={catalogEngine} />
              ))}
              <option value="Other" />
            </datalist>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label>License Plate</Label>
        <Input
          value={licensePlate}
          onChange={(e) => {
            const raw = e.target.value;
            setLicensePlateFormatWarning(getLicensePlateInputWarning(raw));
            setLicensePlate(normalizeLicensePlate(raw));
          }}
          onBlur={(e) => onPlateCommit?.(normalizeLicensePlate(e.target.value))}
          placeholder="ABC123"
        />
        {licensePlateFormatWarning ? (
          <p className="text-xs text-amber-800">{licensePlateFormatWarning}</p>
        ) : null}
        {showLicensePlateHint ? (
          <p className="text-xs text-slate-500">
            Custom and specialty plates are allowed. This only normalizes spacing
            and capitalization.
          </p>
        ) : null}
      </div>

      <div className="space-y-2 md:col-span-2 lg:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <Label>VIN</Label>
          {enableVinLookup ? (
            <button
              type="button"
              onClick={() => void handleVinLookup()}
              disabled={vinLookupLoading || normalizeVin(vin).length !== 17}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-lime-500/50 bg-lime-400/90 px-3 py-1.5 text-sm font-semibold text-black shadow-sm transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {vinLookupLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up…
                </>
              ) : (
                "Lookup VIN"
              )}
            </button>
          ) : null}
        </div>
        <Input
          value={vin}
          onChange={(e) => {
            const raw = e.target.value;
            setVinFormatWarning(getVinInputWarning(raw));
            setVin(normalizeVin(raw));
          }}
          onBlur={(e) => onVinCommit?.(normalizeVin(e.target.value))}
          placeholder="17-character VIN"
          autoComplete="off"
          spellCheck={false}
        />
        {vinFormatWarning ? (
          <p className="text-xs text-amber-800">{vinFormatWarning}</p>
        ) : null}
        {enableVinLookup ? (
          <p className="text-xs text-slate-500">
            U.S. NHTSA database: enter the full VIN, then use Lookup to fill year, make, and model when
            they match your catalog.
          </p>
        ) : null}
        {vinLookupMessage ? (
          <p
            className={`text-xs ${
              vinLookupMessage.includes("Note:") || vinLookupMessage.includes("Network")
                ? "text-amber-800"
                : "text-emerald-800"
            }`}
          >
            {vinLookupMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
