export const workflowStepOrder = [
  "vehicle",
  "mileage",
  "tires",
  "brakes",
  "maintenance",
  "photos",
  "customer-report",
  "review",
] as const;

export const abbreviatedWorkflowStepOrder = [
  "vehicle",
  "mileage",
  "maintenance",
  "photos",
  "customer-report",
  "review",
] as const;

export const workflowStepLabels: Record<string, string> = {
  vehicle: "Customer and vehicle information",
  mileage: "Mileage and service interval",
  tires: "Tire inspection",
  brakes: "Brake inspection",
  maintenance: "Maintenance and undercar inspection",
  photos: "Photos",
  "customer-report": "Customer report",
  review: "Final review",
};
