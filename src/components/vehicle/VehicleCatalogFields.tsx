"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { vehicleCatalog, vehicleMakes } from "@/lib/vehicleCatalog";

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
};

function SearchableSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  onSelect,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between border-slate-300 bg-white px-3 font-normal text-slate-900 hover:bg-slate-50"
        >
          <span className={cn("truncate", !selectedOption && "text-slate-500")}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
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
}: VehicleCatalogFieldsProps) {
  const yearOptions = useMemo(
    () =>
      Array.from({ length: MAX_MODEL_YEAR - 1979 }, (_, index) => {
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
    const exactMake = vehicleMakes.find(
      (catalogMake) => catalogMake.toLowerCase() === String(make || "").toLowerCase()
    );

    return exactMake ? Object.keys(vehicleCatalog[exactMake] ?? {}) : [];
  })();

  const knownEngineSizesForModel = (() => {
    const exactMake = vehicleMakes.find(
      (catalogMake) => catalogMake.toLowerCase() === String(make || "").toLowerCase()
    );

    if (!exactMake) return [];

    const exactModel = Object.keys(vehicleCatalog[exactMake] ?? {}).find(
      (catalogModel) => catalogModel.toLowerCase() === String(model || "").toLowerCase()
    );

    return exactModel ? vehicleCatalog[exactMake][exactModel] ?? [] : [];
  })();

  const modelOptions = useMemo(
    () => knownModelsForMake.map((catalogModel) => ({ label: catalogModel, value: catalogModel })),
    [knownModelsForMake]
  );

  const handleMakeChange = (value: string) => {
    const matchedMake = vehicleMakes.find(
      (catalogMake) => catalogMake.toLowerCase() === String(value || "").trim().toLowerCase()
    );

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

  const handleEngineSizeChange = (value: string) => {
    if (value === "Other") {
      setUseCustomEngineSize(() => true);
      setEngineSize("");
      return;
    }

    setUseCustomEngineSize(() => false);
    setEngineSize(value);
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
          onSelect={(value) => {
            const normalizedValue = normalizeYear(value);
            setYear(normalizedValue);
            onYearCommit?.(normalizedValue);
          }}
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
            onSelect={(value) => {
              handleMakeChange(value);
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
                : "Choose a make first or use Other model"
            }
            searchPlaceholder="Search model..."
            emptyMessage="No matching model found."
            disabled={!knownModelsForMake.length}
            onSelect={(value) => {
              handleModelChange(value);
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
                  : "Choose a model first or use Other engine"
              }
              disabled={!knownEngineSizesForModel.length}
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
          onChange={(e) => setLicensePlate(normalizeLicensePlate(e.target.value))}
          onBlur={(e) => onPlateCommit?.(normalizeLicensePlate(e.target.value))}
          placeholder="ABC123"
        />
        <p className="text-xs text-slate-500">
          Custom and specialty plates are allowed. This only normalizes spacing and capitalization.
        </p>
      </div>

      <div className="space-y-2 md:col-span-2 lg:col-span-2">
        <Label>VIN</Label>
        <Input
          value={vin}
          onChange={(e) => setVin(normalizeVin(e.target.value))}
          onBlur={(e) => onVinCommit?.(normalizeVin(e.target.value))}
          placeholder="17-character VIN"
        />
      </div>
    </div>
  );
}
