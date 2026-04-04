"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_MODEL_YEAR } from "@/lib/input-formatters";
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
  makeListId,
  modelListId,
  engineListId,
  className = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
  onMakeCommit,
  onModelCommit,
  onEngineCommit,
  onPlateCommit,
  onVinCommit,
  onYearCommit,
}: VehicleCatalogFieldsProps) {
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

  const handleMakeChange = (value: string) => {
    if (value === "Other") {
      setUseCustomMake(() => true);
      setUseCustomModel(() => true);
      setUseCustomEngineSize(() => true);
      setMake("");
      setModel("");
      setEngineSize("");
      return;
    }

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
    if (value === "Other") {
      setUseCustomModel(() => true);
      setUseCustomEngineSize(() => true);
      setModel("");
      setEngineSize("");
      return;
    }

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
        <Input
          value={year}
          onChange={(e) => setYear(normalizeYear(e.target.value))}
          onBlur={(e) => onYearCommit?.(normalizeYear(e.target.value))}
          inputMode="numeric"
          maxLength={4}
          placeholder={String(MAX_MODEL_YEAR)}
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
          <>
            <Input
              list={makeListId}
              value={make}
              onChange={(e) => handleMakeChange(e.target.value)}
              onBlur={(e) => {
                handleMakeChange(e.target.value);
                onMakeCommit?.(e.target.value);
              }}
              placeholder="Search or select make"
            />
            <datalist id={makeListId}>
              {vehicleMakes.map((catalogMake) => (
                <option key={catalogMake} value={catalogMake} />
              ))}
              <option value="Other" />
            </datalist>
          </>
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
          <>
            <Input
              list={modelListId}
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              onBlur={(e) => {
                handleModelChange(e.target.value);
                onModelCommit?.(e.target.value);
              }}
              placeholder={
                knownModelsForMake.length
                  ? "Search or select model"
                  : "Choose a make first or use Other model"
              }
              disabled={!knownModelsForMake.length}
            />
            <datalist id={modelListId}>
              {knownModelsForMake.map((catalogModel) => (
                <option key={catalogModel} value={catalogModel} />
              ))}
              <option value="Other" />
            </datalist>
          </>
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
