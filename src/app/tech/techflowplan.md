Plan

Mobile Mechanic Guided Job Flow
Summary
Design the mechanic experience as one mobile-first guided job workspace that starts after the queue and carries the technician from claim through completion without bouncing between separate tech pages.

Default choices locked in:

Keep /tech/jobs as the intake queue.
Replace the current split between /tech/jobs/[jobId]/workflow and /tech?jobId=... with one guided in-job experience.
Optimize for a field mechanic on a phone.
Treat added work approval as an in-flow pause state.
End the flow when service is completed and the final customer-visible update is sent.
Key Changes
Route and screen structure
Keep /tech/jobs as the mechanic’s queue for search, claim, and resume.
Make the opened job land in a single guided workspace at /tech/jobs/[jobId] or keep the current workflow route and make it the only in-job destination.
Retire the need to open the separate generic tech inspection page from inside a job; inspection becomes an embedded phase of the job flow.
Guided mechanic steps
Define one ordered mechanic journey with a persistent progress header and clear “Continue” actions:

Claim job
Review dispatch details
Customer, vehicle, location, appointment window, requested work, internal notes
Arrive on site
Mark arrival, switch intake state to on-site/in service, optional “arrived” customer update
Pre-service check-in
Confirm vehicle identity, mileage, condition photos, existing concerns
Planned work checklist
Complete service line items and see what is still open
Inspection and findings
Tires, brakes, maintenance, notes, additional photos, recommendations
Added work decision
If no added work, continue normally
If added work exists, send approval request, freeze forward progress, move job into waiting-for-approval, then resume in the same workspace after approval
Finish service
Complete remaining work, add post-work notes/photos, finalize report summary
Customer closeout
Send final customer update, mark service complete, return job to completed state
Mobile UX rules
Show one primary action per step: Claim, Start arrival, Begin inspection, Send approval request, Resume work, Complete service.
Keep the job summary pinned at the top in compact form: customer, vehicle, address, status, next step.
Use large tap targets and step cards instead of dense admin-style forms.
Collapse advanced fields behind “Add note”, “More details”, or “Optional documentation”.
Preserve draft/progress automatically so mechanics can leave and resume without losing context.
Show blocked states clearly:
Waiting on parts, Waiting on customer approval, Ready to complete
Public Interfaces / States
Mechanic-facing navigation becomes:
Queue → Single guided job workspace → Completed
User-facing workflow states to standardize in the UI:
Unclaimed, Claimed, On site, In service, Waiting on parts, Awaiting customer approval, Completed
Customer-visible updates should map to mechanic milestones:
arrival, status/progress, approval needed, parts delay, service complete
Existing customer progress view should continue reading the same inspection progress and customer-visible update history; the new flow should improve sequencing, not change the customer’s mental model.
Test Plan
Mechanic can claim an unassigned job and immediately continue into one guided workspace.
Mechanic can move from dispatch review to arrival to inspection without page-hopping.
Mechanic can pause the flow for added-work approval and later resume the same job in the correct step.
Mechanic can mark planned service items done before final completion.
Mechanic can send customer-visible updates at arrival, delay/approval, and completion.
Mechanic can leave mid-job and reopen the job with progress preserved.
Customer portal still shows live progress, notes, and recent updates in the expected order.
Completed jobs exit the active queue and remain readable from manager/customer views.
Assumptions
The current queue, intake states, inspection data model, and customer update model remain the source of truth.
This plan is UX-first, so it does not prescribe schema rewrites unless needed later for implementation.
Manager workflow remains secondary in this phase; manager involvement only matters when the mechanic flow explicitly pauses for approval or completion handoff.
