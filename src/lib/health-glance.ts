export function measuredHealthValue(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function averageMeasuredHealthValue(values: Array<number | null | undefined>): {
  average: number | null;
  count: number;
} {
  const measured = values.filter((value): value is number => measuredHealthValue(value) !== null);
  if (measured.length === 0) return { average: null, count: 0 };

  return {
    average: measured.reduce((sum, value) => sum + value, 0) / measured.length,
    count: measured.length,
  };
}
