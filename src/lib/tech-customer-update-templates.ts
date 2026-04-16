import type { JobCustomerUpdateType } from "@/lib/job-customer-updates";

export const techCustomerUpdateTemplates: Array<{
  id: JobCustomerUpdateType;
  title: string;
  message: string;
}> = [
  {
    id: "arrival",
    title: "Technician is on the way",
    message: "Your technician is in route and will arrive shortly.",
  },
  {
    id: "diagnosis",
    title: "Initial findings",
    message: "We completed an initial check and identified items that need your review.",
  },
  {
    id: "parts_delay",
    title: "Parts delay update",
    message: "We are waiting on parts and will share an updated timeline as soon as they arrive.",
  },
  {
    id: "service_complete",
    title: "Service complete",
    message: "Your service is complete. Please review your report and recommendations in the portal.",
  },
  {
    id: "status",
    title: "Service status update",
    message: "Your service is in progress. We will send another update soon.",
  },
  {
    id: "customer_approval",
    title: "Additional work needs your approval",
    message:
      "We found additional work that was not on the original plan. Please review and approve in your portal so we can continue.",
  },
  {
    id: "general",
    title: "Service update",
    message: "We have an update on your vehicle. Please check your portal for details.",
  },
];
