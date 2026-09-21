import {
  COST_CURRENCY,
  COST_DECIMALS,
  COST_LABEL_SEPARATOR,
  COST_SMALL_DECIMALS,
  COST_SMALL_THRESHOLD,
  MATCH_COST_LABEL,
  PUZZLE_COST_LABEL,
  ZERO_COST,
} from "./constants.ts";

export function decisionCost(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > ZERO_COST ? value : ZERO_COST;
}

export function addGameCost<T extends { cost: number }>(game: T, cost: number | undefined): T {
  const extra = decisionCost(cost);
  if (extra === ZERO_COST) {
    return game;
  }
  return { ...game, cost: game.cost + extra };
}

export function formatUsd(amount: number): string {
  if (amount <= ZERO_COST) {
    return `${COST_CURRENCY}${ZERO_COST}`;
  }
  const decimals = amount < COST_SMALL_THRESHOLD ? COST_SMALL_DECIMALS : COST_DECIMALS;
  return `${COST_CURRENCY}${amount.toFixed(decimals)}`;
}

export function formatLabeledCost(label: string, amount: number): string {
  return `${label}${COST_LABEL_SEPARATOR}${formatUsd(amount)}`;
}

export function formatMatchCost(amount: number): string {
  return formatLabeledCost(MATCH_COST_LABEL, amount);
}

export function formatPuzzleCost(amount: number): string {
  return formatLabeledCost(PUZZLE_COST_LABEL, amount);
}
