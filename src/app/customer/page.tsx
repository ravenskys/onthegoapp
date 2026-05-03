import { redirect } from "next/navigation";

export default function CustomerPortalIndexPage() {
  redirect("/customer/dashboard");
}
