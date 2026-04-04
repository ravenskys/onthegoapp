export const workflowStepOrder = [
  "vehicle",
  "tires",
  "brakes",
  "maintenance",
  "photos",
  "customer-report",
  "review",
] as const;

export const workflowStepLabels: Record<string, string> = {
  vehicle: "Customer and vehicle information",
  tires: "Tire inspection",
  brakes: "Brake inspection",
  maintenance: "Maintenance and undercar inspection",
  photos: "Photos",
  "customer-report": "Customer report",
  review: "Final review",
};
