type InspectionRecommendationEntry = {
  status?: string;
  why?: string;
  recommendation?: string;
};

export function getInspectionRecommendations({
  maintenance,
  undercar,
  brakes,
  tireData,
  tires,
}: {
  maintenance: Record<string, InspectionRecommendationEntry>;
  undercar: Record<string, InspectionRecommendationEntry>;
  brakes: { status?: string; brakeNotes?: string };
  tireData: Record<string, InspectionRecommendationEntry>;
  tires: string[];
}) {
  const items: string[] = [];

  Object.entries(maintenance).forEach(([name, value]) => {
    if (value?.status === "req" || value?.status === "sug") {
      items.push(`${name}${value?.why ? ` - ${value.why}` : ""}`);
    }
  });

  Object.entries(undercar).forEach(([name, value]) => {
    if (value?.status === "req" || value?.status === "sug") {
      items.push(`${name}${value?.why ? ` - ${value.why}` : ""}`);
    }
  });

  if (brakes.status === "req" || brakes.status === "sug") {
    items.push(`Brake service${brakes.brakeNotes ? ` - ${brakes.brakeNotes}` : ""}`);
  }

  tires.forEach((tire) => {
    const tireEntry = tireData[tire];
    if (tireEntry?.status === "req" || tireEntry?.status === "sug") {
      items.push(`${tire} tire${tireEntry?.recommendation ? ` - ${tireEntry.recommendation}` : ""}`);
    }
  });

  return items;
}
