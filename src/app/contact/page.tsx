"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicPageHero } from "@/components/site/PublicPageHero";
import { PublicSiteLayout } from "@/components/site/PublicSiteLayout";
import { formatPhoneNumber } from "@/lib/input-formatters";
import {
  SITE_EMAIL,
  SITE_EMAIL_MAILTO_HREF,
  SITE_PHONE_DISPLAY,
  SITE_PHONE_TEL_HREF,
} from "@/lib/site-contact";

export default function ContactPage() {
  const [contactPhone, setContactPhone] = useState("");

  return (
    <PublicSiteLayout activePath="/contact">
      <PublicPageHero
        title="Contact"
        accent="Us"
        body="Schedule mobile maintenance, inspections, or fleet support and we will follow up to confirm service details."
      />

      <section className="otg-section">
        <div className="otg-site-container otg-grid-2">
          <div>
            <div className="otg-contact-card" style={{ marginBottom: 24 }}>
              <h3 className="otg-card-title">Contact Information</h3>
              <p>Phone: {SITE_PHONE_DISPLAY}</p>
              <p>Email: {SITE_EMAIL}</p>
              <p>
                Reach out to discuss service availability, scheduling, and support
                for personal or fleet vehicles.
              </p>
            </div>

            <div className="otg-contact-card">
              <h3 className="otg-card-title">Hours</h3>
              <p>Saturday - Sunday: 9:00 AM - 7:00 PM</p>
              <p>Monday - Thursday: 4:30 PM - 7:00 PM</p>
              <p>Friday: Closed</p>
            </div>
          </div>

          <div className="otg-contact-card">
            <h3 className="otg-card-title">Request an Appointment</h3>
            <p className="otg-body">
              Use this request form as the public booking entry point. We can wire
              it to email or a booking workflow next.
            </p>

            <form className="mt-6 space-y-4">
              <div>
                <label className="otg-label">Full Name</label>
                <input className="otg-input mt-2" type="text" placeholder="Your name" />
              </div>

              <div>
                <label className="otg-label">Phone Number</label>
                <input
                  className="otg-input mt-2"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(formatPhoneNumber(e.target.value))}
                  placeholder="(555) 555-5555"
                />
              </div>

              <div>
                <label className="otg-label">Service Needed</label>
                <select className="otg-select mt-2" defaultValue="">
                  <option value="" disabled>
                    Select a service
                  </option>
                  <option>Oil Change</option>
                  <option>Fluid Service</option>
                  <option>Preventive Maintenance</option>
                  <option>Inspection</option>
                  <option>Fleet Service</option>
                  <option value="other">Other — describe in the details below</option>
                </select>
              </div>

              <div>
                <label className="otg-label">Vehicle / service details</label>
                <textarea
                  className="otg-textarea mt-2"
                  placeholder="Tell us about your vehicle and what service you need. If you chose Other above, describe the work or concern here."
                />
              </div>

              <button type="submit" className="otg-btn otg-btn-primary">
                Submit Request
              </button>
            </form>

            <div className="otg-callout">
              Need account access instead? Use the portal if you already have a
              linked customer, technician, manager, or admin login.
            </div>
          </div>
        </div>
      </section>

      <section className="otg-cta">
        <div className="otg-site-container">
          <h2>Need a Faster Path?</h2>
          <p>
            Call, email, or head to the portal if you are checking an existing
            service record or internal workflow.
          </p>
          <div className="otg-button-row" style={{ justifyContent: "center" }}>
            <a href={SITE_PHONE_TEL_HREF} className="otg-btn otg-btn-primary">
              Call Now
            </a>
            <a href={SITE_EMAIL_MAILTO_HREF} className="otg-btn otg-btn-primary">
              Email Us
            </a>
            <Link href="/portal" className="otg-btn otg-btn-primary">
              Open Portal
            </Link>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
