import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookNowLink } from "@/components/site/BookNowLink";
import { PublicPageHero } from "@/components/site/PublicPageHero";
import { PublicSiteLayout } from "@/components/site/PublicSiteLayout";
import { marketingPageMetadata } from "@/lib/site-seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Fleet Services",
  description:
    "Mobile fleet maintenance for Idaho businesses—routine service at your yard, workplace, or job site to help keep work vehicles on the road with less downtime.",
  path: "/fleet-services",
});

export default function FleetServicesPage() {
  return (
    <PublicSiteLayout activePath="/fleet-services">
      <PublicPageHero
        title="Fleet"
        accent="Services"
        body="Mobile maintenance support that helps businesses keep working vehicles serviced, road-ready, and operating with less downtime."
      />

      <section className="otg-section">
        <div className="otg-site-container otg-content-split">
          <div className="otg-content-card">
            <h2>
              Built for <span>Working Vehicles</span>
            </h2>
            <p>
              Fleet vehicles are essential to daily operations, and downtime can
              cost both time and money. We bring routine maintenance directly to
              your business, workplace, yard, or job site.
            </p>
            <p>
              Whether you manage a few work trucks or a growing service fleet, our
              goal is to support reliable upkeep that keeps vehicles in service.
            </p>
            <p>
              Mobile fleet maintenance helps simplify scheduling and reduce the
              interruptions that come with pulling vehicles off the road.
            </p>
          </div>

          <div className="otg-site-panel">
            <Image
              src="/images/inspection.webp"
              alt="Fleet vehicle maintenance service"
              width={900}
              height={700}
              className="otg-image-fill"
            />
          </div>
        </div>
      </section>

      <section className="otg-section otg-section-alt">
        <div className="otg-site-container">
          <div className="otg-section-title-wrap">
            <h2>Why Businesses Choose Mobile Fleet Service</h2>
            <p>
              Fleet maintenance should be practical, efficient, and easy to
              schedule around business operations.
            </p>
          </div>

          <div className="otg-grid-2">
            <div className="otg-highlight-box">
              <h3 className="otg-card-title">Reduced Downtime</h3>
              <p>
                Less time coordinating shop trips means more time keeping vehicles
                ready for work.
              </p>
            </div>
            <div className="otg-highlight-box">
              <h3 className="otg-card-title">Convenient Scheduling</h3>
              <p>
                Maintenance can be planned around your workday, team schedule, and
                active job sites.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="otg-section">
        <div className="otg-site-container">
          <div className="otg-section-title-wrap">
            <h2>Fleet Maintenance Services</h2>
            <p>
              Routine mobile services designed to help keep fleet vehicles
              operating reliably.
            </p>
          </div>

          <div className="otg-grid-3">
            <div className="otg-service-card">
              <h3 className="otg-card-title">Oil Changes</h3>
              <p>Mobile oil change service for work trucks, vans, and fleet units.</p>
              <ul>
                <li>Standard oil changes</li>
                <li>Higher-capacity vehicles</li>
                <li>Additional quarts available</li>
                <li>Diesel oil change options</li>
              </ul>
            </div>
            <div className="otg-service-card">
              <h3 className="otg-card-title">Fluid Services</h3>
              <p>
                Essential fluid checks and routine maintenance support for working
                vehicles.
              </p>
              <ul>
                <li>Fluid level checks</li>
                <li>Top-offs as needed</li>
                <li>Basic under-hood checks</li>
                <li>Routine maintenance support</li>
              </ul>
            </div>
            <div className="otg-service-card">
              <h3 className="otg-card-title">Inspections</h3>
              <p>
                Visual inspections help identify maintenance concerns before they
                affect operations.
              </p>
              <ul>
                <li>Tire condition review</li>
                <li>Brake visual checks</li>
                <li>Battery inspection</li>
                <li>Visible wear-item review</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="otg-section otg-section-alt">
        <div className="otg-site-container">
          <div className="otg-section-title-wrap">
            <h2>Who Fleet Service Is For</h2>
            <p>
              A strong fit for businesses that want simpler maintenance planning and
              dependable vehicle care.
            </p>
          </div>

          <div className="otg-grid-3">
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Contractors</h3>
              <p>Keep work trucks and vans maintained so your team can stay on schedule.</p>
            </div>
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Small Businesses</h3>
              <p>Support business vehicles with convenient maintenance at your location.</p>
            </div>
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Growing Fleets</h3>
              <p>Maintain multiple vehicles more efficiently with mobile routine service.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="otg-cta">
        <div className="otg-site-container">
          <h2>Need Fleet Service?</h2>
          <p>
            Contact us to discuss mobile maintenance for your business vehicles,
            work trucks, service vans, or growing fleet.
          </p>
          <BookNowLink className="otg-btn otg-btn-primary">
            Book Fleet Service
          </BookNowLink>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
