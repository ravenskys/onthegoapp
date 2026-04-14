/**
 * Global shop rule: **part customer unit sell price** from **shop unit cost**.
 *
 * Import from **`@/lib/pricing`** (recommended) or this file. **Do not duplicate** tier math in
 * components — use {@link unitSellPriceFromUnitCost} or {@link resolvePartUnitPriceForSave}.
 *
 * **Rule (USD):**
 * - Minimum sell unit price: {@link PART_UNIT_SELL_RULE.minSellUnitPrice}
 * - Cost ≤ {@link PART_UNIT_SELL_RULE.costBlendStartUsd}: sell = cost × {@link PART_UNIT_SELL_RULE.multiplierBelowBlendUsd} (smooth start, no cliff at $50)
 * - Cost between that and {@link PART_UNIT_SELL_RULE.costBlendEndUsd}: multiplier **linearly** ramps
 *   from {@link PART_UNIT_SELL_RULE.multiplierBelowBlendUsd} down to {@link PART_UNIT_SELL_RULE.multiplierEndBlendUsd}
 *   (so sell rises smoothly — no jump at $50.01)
 * - Cost &gt; {@link PART_UNIT_SELL_RULE.costBlendEndUsd}: sell = cost × {@link PART_UNIT_SELL_RULE.multiplierAboveBlendUsd}
 *
 * Bump {@link PART_UNIT_SELL_RULE.version} when the curve changes.
 */

/** Versioned parameters for part sell-from-cost (single source of truth). */
export const PART_UNIT_SELL_RULE = {
  version: 2 as const,
  /** Minimum customer unit price when deriving from cost. */
  minSellUnitPrice: 5,
  /**
   * For unit cost **at or below** this (USD), use {@link multiplierBelowBlendUsd} only
   * (constant ×1.5 up through this cost).
   */
  costBlendStartUsd: 50,
  /**
   * For unit cost **above** {@link costBlendStartUsd} through this (USD), the sell multiplier
   * **linearly interpolates** from {@link multiplierBelowBlendUsd} to {@link multiplierEndBlendUsd}.
   */
  costBlendEndUsd: 150,
  /** Sell multiplier for cost ≤ {@link costBlendStartUsd} (×1.5). */
  multiplierBelowBlendUsd: 1.5,
  /** Sell multiplier reached at {@link costBlendEndUsd} (×1.25). */
  multiplierEndBlendUsd: 1.25,
  /** Sell multiplier for cost **above** {@link costBlendEndUsd} (×1.25). */
  multiplierAboveBlendUsd: 1.25,
} as const;

/** @deprecated Prefer `PART_UNIT_SELL_RULE.minSellUnitPrice` */
export const MIN_PART_SELL_UNIT_PRICE = PART_UNIT_SELL_RULE.minSellUnitPrice;

function sellMultiplierForUnitCost(unitCost: number): number {
  const {
    costBlendStartUsd,
    costBlendEndUsd,
    multiplierBelowBlendUsd,
    multiplierEndBlendUsd,
    multiplierAboveBlendUsd,
  } = PART_UNIT_SELL_RULE;

  if (unitCost <= costBlendStartUsd) {
    return multiplierBelowBlendUsd;
  }

  if (unitCost <= costBlendEndUsd) {
    const span = costBlendEndUsd - costBlendStartUsd;
    const t = (unitCost - costBlendStartUsd) / span;
    return multiplierBelowBlendUsd + t * (multiplierEndBlendUsd - multiplierBelowBlendUsd);
  }

  return multiplierAboveBlendUsd;
}

/**
 * Customer unit sell price from shop unit cost (progressive multiplier + minimum sell price).
 * Returns `null` if cost is not a positive finite number.
 */
export function unitSellPriceFromUnitCost(unitCost: number): number | null {
  if (!Number.isFinite(unitCost) || unitCost <= 0) {
    return null;
  }

  const mult = sellMultiplierForUnitCost(unitCost);
  const raw = unitCost * mult;
  const rounded = Math.round(raw * 100) / 100;
  return Math.max(PART_UNIT_SELL_RULE.minSellUnitPrice, rounded);
}

/** String for `<input type="number">` from a derived sell price. */
export function formatSellPriceForPartInput(price: number): string {
  return (Math.round(price * 100) / 100).toFixed(2);
}

/**
 * Value to persist: explicit unit price if the price field is non-empty, otherwise derived from
 * unit cost when cost is a positive number.
 */
export function resolvePartUnitPriceForSave(
  unitCostStr: string,
  unitPriceStr: string,
): number | null {
  const pTrim = unitPriceStr.trim();
  if (pTrim !== "") {
    const p = Number(pTrim);
    return Number.isFinite(p) ? p : null;
  }
  const cTrim = unitCostStr.trim();
  if (cTrim === "") {
    return null;
  }
  const c = Number(cTrim);
  if (!Number.isFinite(c) || c <= 0) {
    return null;
  }
  return unitSellPriceFromUnitCost(c);
}
