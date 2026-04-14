/**
 * **Canonical pricing entry point** for the app.
 *
 * Part **unit sell price from unit cost** uses {@link PART_UNIT_SELL_RULE} — do not reimplement
 * tier multipliers on individual pages; import helpers from here instead.
 *
 * @example New UI deriving sell from cost
 * ```ts
 * import { unitSellPriceFromUnitCost, formatSellPriceForPartInput } from "@/lib/pricing";
 * ```
 */

export {
  PART_UNIT_SELL_RULE,
  MIN_PART_SELL_UNIT_PRICE,
  formatSellPriceForPartInput,
  resolvePartUnitPriceForSave,
  unitSellPriceFromUnitCost,
} from "./part-unit-price";
