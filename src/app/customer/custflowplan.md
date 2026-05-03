Plan

Customer Guided Portal Flow

Summary
Design the customer experience as one clear portal journey that starts from a simple overview, moves into booking or requesting service, shows live progress during an active visit, and ends with completed reports and account history.

Default choices locked in:

- Keep `/customer/dashboard` as the customer overview and hub.
- Keep `/customer/book` as the guided "how do you want to start?" entry step.
- Keep `/customer/schedule` as the detailed booking/request form that continues the same service intake flow.
- Keep `/customer/progress` for live in-service visibility.
- Keep `/customer/reports` for completed inspection reports, PDFs, and photos.
- Keep `/customer/account` for contact info, vehicles, service addresses, and account access.

Key Changes

Route and screen structure

- `/customer` should redirect directly to `/customer/dashboard`.
- The customer portal should feel like one guided journey instead of separate disconnected pages.
- Main customer pages should share the same visible journey strip so users always know where they are in the portal.
- Booking-related routes should behave like one flow: `Get Service` -> `Schedule Service`.

Guided customer steps

Define one ordered customer journey with a consistent top-level flow:

1. Overview
Customer lands on the portal hub and sees the main actions for service, progress, reports, and account updates.

2. Get service
Customer chooses whether to book a time or send a request first, then confirms the vehicle.

3. Schedule / request details
Customer finishes the intake details: service type, address, notes, and either a time slot or a request description.

4. Service progress
Customer watches technician progress, workflow milestones, notes, and customer-visible updates during an active visit.

5. Reports
Customer opens completed inspection history by vehicle, including PDFs and photo galleries.

6. Account
Customer maintains profile info, vehicles, and saved service addresses so the rest of the portal stays accurate.

UX Rules

- Keep the portal language simple and customer-facing.
- Show large, obvious actions near the top of the overview page.
- Keep booking and requesting service in the same guided intake path.
- Reuse one customer journey component across the major portal pages.
- Make the "Get Service" navigation item stay active on both `/customer/book` and `/customer/schedule`.
- Make reports and account pages easy to jump to after service is finished.

Public customer states

- Ready to book
- Request sent
- Scheduled
- In service
- Awaiting update
- Completed with report available

Test Plan

- Visiting `/customer` sends the customer to `/customer/dashboard`.
- Dashboard, booking, progress, reports, and account all show the same customer journey strip.
- `Get Service` remains highlighted for both `/customer/book` and `/customer/schedule`.
- A customer can move from overview into booking without losing context.
- A customer with an active visit can move from overview to progress and still understand where they are in the flow.
- A customer with completed reports can move from overview to reports and open files by vehicle.
- Account remains the place to manage vehicles and addresses used by the booking flow.

Assumptions

- Existing customer auth, portal data loaders, report grouping, and scheduling logic remain the source of truth.
- This plan is focused on the current portal UX and navigation, not a data-model rewrite.
- Customer progress should continue reading the same inspection workflow and customer update history already used by the technician flow.
