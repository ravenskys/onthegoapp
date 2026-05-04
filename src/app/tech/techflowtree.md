Technician Flow Process Tree

```text
Technician Portal
|
+-- /tech
|   |
|   +-- Technician Home / Hub
|       |
|       +-- Active Job Card
|       +-- Queue Shortcut
|       +-- Drafts Shortcut
|       +-- Recent Completed Work (optional later)
|       |
|       +-- Default route -> /tech/jobs
|
+-- /tech/jobs
|   |
|   +-- Technician Queue
|       |
|       +-- Search
|       +-- Filters
|       +-- Claim Job
|       +-- Resume Job
|       +-- Open Draft
|       |
|       +-- Open active job -> /tech/jobs/[jobId]
|
+-- /tech/jobs/[jobId]
    |
    +-- Stage 1: Dispatch Review
    |   |
    |   +-- Customer Name
    |   +-- Customer Phone
    |   +-- Service Address
    |   +-- Appointment Window
    |   +-- Requested Work Summary
    |   +-- Internal Notes
    |   +-- Vehicle Summary
    |   |
    |   +-- Primary action -> Start Arrival
    |
    +-- Stage 2: Arrive at Service Location
    |   |
    |   +-- Mark Arrived
    |   +-- Confirm Customer
    |   +-- Confirm Vehicle
    |   +-- Keep service location visible
    |   |
    |   +-- Primary action -> Begin Pre-Inspection
    |
    +-- Stage 3: Customer Complaint and Requested Services
    |   |
    |   +-- Capture customer complaint
    |   +-- Review original requested work
    |   +-- Select requested services from full list
    |   +-- Add technician-discovered services
    |   +-- Mark service source
    |   |   |
    |   |   +-- Customer-requested
    |   |   +-- Technician-added
    |   |
    |   +-- Add notes for extra service recommendations
    |   |
    |   +-- Primary action -> Confirm Complaint and Services
    |
    +-- Stage 4: Pre-Inspection Check-In
    |   |
    |   +-- Customer info visible
    |   +-- Vehicle info visible
    |   +-- Mileage entry
    |   +-- VIN confirmation
    |   +-- Existing concerns
    |   |
    |   +-- Required pre-inspection photos
    |   |   |
    |   |   +-- 4 corner photos
    |   |   |   |
    |   |   |   +-- Front left
    |   |   |   +-- Front right
    |   |   |   +-- Rear right
    |   |   |   +-- Rear left
    |   |   |
    |   |   +-- 2 interior photos minimum
    |   |   +-- 1 VIN photo
    |   |
    |   +-- Block completion if photo minimums are missing
    |   |
    |   +-- Primary action -> Complete Pre-Inspection
    |
    +-- Stage 5: Inspection and Findings
    |   |
    |   +-- Choose inspection product
    |   |   |
    |   |   +-- Mini Inspection
    |   |   |   |
    |   |   |   +-- Oil change / light service flow
    |   |   |   +-- Tire information included
    |   |   |   +-- Basic brake / maintenance observations
    |   |   |   +-- Reduced steering-component depth
    |   |   |
    |   |   +-- Full Paid Inspection
    |   |       |
    |   |       +-- Expanded component checks
    |   |       +-- Deeper findings and recommendations
    |   |
    |   +-- Notes
    |   +-- Findings
    |   +-- Recommendations
    |   +-- Supporting photos
    |   |
    |   +-- Primary action -> Finish Inspection and Review Quote
    |
    +-- Stage 6: Quote and Approval Decision
    |   |
    |   +-- Build quote from selected services
    |   +-- Edit quote after inspection
    |   |   |
    |   |   +-- Add services
    |   |   +-- Remove services
    |   |   +-- Adjust service details
    |   |   +-- Update quote notes
    |   |
    |   +-- Customer quote response
    |   |   |
    |   |   +-- Accept
    |   |   +-- Decline
    |   |   +-- Electronic signature
    |   |
    |   +-- Decision branch
    |       |
    |       +-- No approval needed
    |       |   |
    |       |   +-- Continue Service
    |       |
    |       +-- Approval required
    |           |
    |           +-- Send Quote for Approval
    |           +-- Move job to Awaiting Approval
    |           +-- Freeze forward progress
    |           +-- Resume after approval
    |
    +-- Stage 7: Planned Service Work
    |   |
    |   +-- Show approved / in-scope services only
    |   +-- Perform agreed-to work
    |   +-- Check off completed services
    |   +-- Add work notes
    |   +-- Add work photos if needed
    |   |
    |   +-- Primary action -> Continue to Closeout
    |
    +-- Stage 8: Service Wrap-Up
    |   |
    |   +-- Post-work notes
    |   +-- Post-work photos
    |   +-- Final technician summary
    |   +-- Confirm work completion
    |   |
    |   +-- Primary action -> Prepare Payment and Closeout
    |
    +-- Stage 9: Payment and Receipt
    |   |
    |   +-- Show final approved service lines
    |   +-- Show final total
    |   +-- Take payment in the field
    |   +-- Record payment status
    |   +-- Generate receipt
    |   +-- Send receipt to customer
    |   +-- Store receipt in customer portal history
    |   |
    |   +-- Primary action -> Take Payment
    |
    +-- Stage 10: Customer Closeout
        |
        +-- Final customer-facing update
        +-- Report summary
        +-- Attach report / PDF
        +-- Confirm receipt stored in customer history
        +-- Mark service complete
        |
        +-- Primary action -> Complete Service
```

Spoke Views Inside Active Job

```text
Active Job
|
+-- Summary Header
+-- Complaint / Requested Services
+-- Pre-Inspection Photos
+-- Mini Inspection
+-- Full Inspection
+-- Quote Preview / Approval Status
+-- Planned Service Checklist
+-- Payment
+-- Receipt Preview
+-- Customer Updates
+-- Report Preview
+-- Draft / Saved Progress
```

Decision Logic

```text
Job Opened
|
+-- Complaint + services confirmed?
|   |
|   +-- No -> stay in complaint/services stage
|   +-- Yes -> continue
|
+-- Pre-inspection photo minimum met?
|   |
|   +-- No -> block progress
|   +-- Yes -> continue
|
+-- Inspection type?
|   |
|   +-- Mini inspection
|   +-- Full paid inspection
|
+-- Quote approval needed?
|   |
|   +-- No -> continue to service work
|   +-- Yes
|       |
|       +-- Customer accepts + signs -> continue
|       +-- Customer declines -> revise scope or stop
|
+-- Approved services completed?
|   |
|   +-- No -> stay in service work
|   +-- Yes -> continue
|
+-- Payment collected?
|   |
|   +-- No -> stay in payment stage
|   +-- Yes -> send/store receipt
|
+-- Receipt sent and stored?
    |
    +-- No -> stay in closeout/payment follow-up
    +-- Yes -> complete service
```
