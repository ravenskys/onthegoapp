Plan

Technician Service Stage Flow

Summary
Design the technician experience around the real stages of a mobile service visit, not around one oversized inspection page. The main technician flow should read like the job itself: dispatch, arrival, complaint capture, requested services, pre-inspection, inspection, quote/approval, service work, closeout, and completion.

Default choices locked in

Keep `/tech/jobs` as the technician queue and job intake screen.
Make `/tech` the technician home/hub that routes into the queue or an active in-progress job.
Keep the actual service work inside a guided job experience at `/tech/jobs/[jobId]`.
Design mobile-first, with each stage feeling like a focused task screen.
Use a spoke-and-wheel structure:
- hub = technician home / current active job
- spokes = queue, active job stage screens, photos, customer updates, report/closeout

Core design direction

The technician should move through service stages in order.
The UI should always answer:
- where am I in the visit
- what do I need to do next
- what is required before I can continue

Every stage should have:
- one primary action
- required information clearly marked
- immediate feedback on save/complete actions
- visible blocked-state messaging when something is missing

Primary technician stages

1. Dispatch Review
- Customer name
- Phone
- Service address
- Appointment window
- Requested work
- Internal notes
- Vehicle summary if already known
- Primary action: `Start Arrival`

2. Arrive at Service Location
- Mark technician as arrived
- Show customer information prominently
- Show vehicle information prominently
- Confirm the correct vehicle before service starts
- Primary action: `Begin Pre-Inspection`

3. Customer Complaint and Requested Services
- Capture the customer complaint in the customer’s own words
- Show the original requested work if it already exists on the job
- Let the technician confirm which requested services are in scope
- Show a service selector with all supported service options
- Allow the technician to add more services discovered during intake
- Distinguish between:
  - customer-requested services
  - technician-added recommended services
- Support quick notes for why an extra service is being added
- If pricing is needed before work continues, technician should be able to create a quote from the selected services
- Primary action: `Confirm Complaint and Services`

Rules for this stage:
- A complaint summary should exist before the technician moves deeper into the visit
- At least one requested or selected service should be attached to the job
- Added services should remain editable until the quote/approval point

4. Pre-Inspection Check-In
- Customer information must remain visible
- Vehicle information must remain visible
- Mileage entry
- VIN confirmation
- Existing concern notes
- Required pre-inspection photo checklist

Required pre-inspection photos:
- 4 corner photos
  - front left corner
  - front right corner
  - rear right corner
  - rear left corner
- at least 2 interior photos
- 1 VIN photo

Rules for this stage:
- Technician cannot complete pre-inspection until all required photos are present
- VIN photo should be treated as required documentation, not optional
- Interior photo minimum must be enforced
- Primary action: `Complete Pre-Inspection`

5. Inspection and Findings
- The inspection flow must split into two different products:
  - mini inspection
  - full paid inspection
- These should not be treated like the same checklist with a few hidden fields

Mini inspection requirements
- Used for lighter visits like oil changes and basic service stops
- Must include tire information again
- Should include:
  - tire condition / tread / pressures as appropriate
  - basic brake and maintenance observations
  - simple notes and recommendations
- Remove some of the steering-component depth from the mini inspection
- Keep the mini inspection faster, lighter, and easier to complete on site

Full paid inspection requirements
- More comprehensive and billable
- Can include the deeper inspection categories and expanded component checks
- This is where the broader inspection depth belongs, not in the quick mini flow

Rules for inspection split
- The technician must know which inspection type applies before starting
- The UI and checklist should visibly change based on inspection type
- The mini inspection should not feel like an incomplete version of the full inspection; it should feel intentionally designed
- Primary action: `Finish Inspection and Review Quote`

6. Quote and Approval Decision
- Build a customer-facing quote from the selected service lines
- Include:
  - customer-requested services
  - technician-added services
  - optional notes/reasons for added services
  - estimated labor, parts, fees, and totals when available
- Technician should be able to revise and edit the quote after the inspection
- Technician should be able to:
  - add services
  - remove services
  - adjust service line details
  - update quote notes before sending to the customer
- If no added work, continue
- If added work exists:
  - create/send quote for approval
  - clearly freeze forward progress
  - move job into awaiting approval
  - resume in the same job once approved
- Primary action: `Send Quote for Approval` or `Continue Service`

Rules for this stage:
- Technician can add services and create a quote without leaving the active job flow
- Quote should be reviewable before sending
- Customer should be able to:
  - accept the quote
  - decline the quote
  - electronically sign the quote
- Customer approval state must be obvious and block the next service stage when required

7. Planned Service Work
- Show approved or in-scope job line items
- Let technician mark work items complete
- Allow service notes during work
- Allow additional service photos if needed
- Only agreed-to / approved services should be worked and checked off
- Technician should be able to mark each approved service as completed
- Primary action: `Continue to Closeout`

8. Service Wrap-Up
- Post-work notes
- Post-work photos if required by the service type
- Final technician summary
- Confirm work completed
- Primary action: `Prepare Payment and Closeout`

9. Payment and Receipt
- Technician must be able to take payment in the field
- Show final approved service lines and totals before collecting payment
- Record payment outcome
- Generate/send a customer receipt
- Store the receipt in customer portal history for later reference
- Primary action: `Take Payment`

Rules for this stage:
- Receipt should be tied to the completed job
- Customer should be able to access the receipt later from portal history
- Payment state should be visible to technician before final completion

10. Customer Closeout
- Final customer-facing update
- Report summary
- Attach report/PDF if part of the workflow
- Confirm receipt was sent and saved to customer history
- Mark service complete
- Primary action: `Complete Service`

Technician hub and spoke structure

Technician home `/tech`
- current active job card if one exists
- quick link to queue
- quick link to drafts
- quick link to recent completed work if needed later

Queue `/tech/jobs`
- claim
- resume
- search
- filter

Active job `/tech/jobs/[jobId]`
- stage header
- compact service summary
- progress indicator
- one primary action at a time

Optional spoke screens inside a job
- photos
- complaint and requested services
- mini inspection
- full inspection
- quote preview
- payment
- receipt preview
- customer updates
- report preview
- drafts / saved progress

Mobile UX rules

Use a stage header at the top of the active job.
Keep customer, vehicle, and location visible in a compact summary card.
Use large tap targets and vertical stacking.
Do not bury required items inside tabs without clear warnings.
Required-photo progress should be visible as counts:
- corner photos: `4/4`
- interior photos: `2/2 minimum`
- VIN photo: `1/1`

Block forward progress clearly when requirements are missing.
Example messages:
- `Add all 4 corner photos before continuing.`
- `Add at least 2 interior photos before continuing.`
- `Add a VIN photo before continuing.`

Customer and vehicle information requirements

At minimum, the arrival and pre-inspection stages should surface:
- customer full name
- customer phone
- service location
- vehicle year/make/model
- plate if available
- VIN if available
- mileage entry during pre-inspection

The technician should not need to leave the active stage to see core customer or vehicle details.

Complaint, service, and quote requirements

The active job flow should support:
- one complaint summary
- one or more requested services
- technician-added services discovered during diagnosis or intake
- a reviewable quote built from those services when approval is needed

The technician should be able to:
- select services from the full service list
- add additional services on site
- explain why added services were recommended
- generate and edit a quote for customer review without sending the job back to manager first

Inspection product requirements

The system should support two clearly different inspection experiences:
- mini inspection
- full paid inspection

Mini inspection goals
- fast
- service-focused
- still useful to the customer
- must include tire information
- should remove some of the steering-component depth

Full inspection goals
- more comprehensive
- more detailed findings
- supports the billed inspection product

Quote rules

If technician-added services affect price or scope:
- build or update a quote in-flow
- send the quote for customer approval
- block further work when approval is required

Customer quote response rules
- Customer can accept or decline the quoted services
- Customer can electronically sign the quote
- Technician should see the resulting state clearly inside the active job flow

If no approval is required:
- continue directly into service completion flow

Payment and receipt requirements

After approved work is completed, the technician should be able to:
- see the final approved service list
- confirm completed services
- take payment
- send the customer a receipt

Receipt storage requirements
- Receipt should be stored in the customer portal history
- Customer should be able to reference the receipt later if needed
- Receipt should be associated with the completed visit/job

Action feedback requirements

Every primary action should respond immediately with one of:
- spinner
- disabled pending state
- inline success message
- inline validation message
- inline error message

Avoid relying on browser alerts for normal workflow actions.

Test plan

Technician can open `/tech` and land safely in the queue or active job hub.
Technician can move from dispatch review to arrival to complaint/services capture to pre-inspection without page confusion.
Technician can record customer complaint and attach at least one requested service.
Technician can select services from a full service list and add more services during intake.
Pre-inspection cannot complete without:
- 4 corner photos
- 2 interior photos minimum
- 1 VIN photo
Customer and vehicle details remain visible during arrival and pre-inspection.
Mini inspection includes tire information and excludes some of the deeper steering-component checks.
Full paid inspection remains the deeper inspection product.
Technician can edit the quote after the inspection before sending it to the customer.
Customer can accept or decline the quote and electronically sign it.
Technician can create a quote from selected/requested services when additional approval is needed.
Technician can pause for quote approval or added-work approval and resume in the same flow.
Technician can complete planned service work after quote approval and continue into closeout.
Technician can check off agreed-to services as completed.
Technician can take payment after work is complete.
Customer receipt is sent and stored in customer portal history for later reference.
Technician can complete service and send the final update without page hopping.
Mobile users can navigate each stage reliably with the hamburger and portal nav.

Assumptions

The existing queue, job, inspection, customer update, and report models remain the source of truth unless implementation proves a schema change is necessary.
The immediate priority is a better technician UX and route structure, not a backend rewrite.
If the current giant `/tech` workspace conflicts with this plan, the flow plan should win and the route structure should be simplified around the stage model.
