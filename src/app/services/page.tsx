import Image from "next/image";
import Link from "next/link";
import { PublicPageHero } from "@/components/site/PublicPageHero";
import { PublicSiteLayout } from "@/components/site/PublicSiteLayout";

export default function ServicesPage() {
  return (
    <PublicSiteLayout activePath="/services">
      <PublicPageHero
        title="Our"
        accent="Services"
        body="Mobile maintenance and inspection services designed to keep personal and work vehicles road-ready with less downtime."
      />

      <section className="otg-section">
        <div className="otg-site-container">
          <div className="otg-content-split">
            <div className="otg-site-panel">
              <Image
                src="/images/oil-change.png"
                alt="Oil change service"
                width={900}
                height={700}
                className="otg-image-fill"
              />
            </div>
            <div className="otg-content-card">
              <h2>
                Oil Changes &amp; <span>Fluid Service</span>
              </h2>
              <p>
                On-site oil changes and essential fluid service for personal
                vehicles, work trucks, and fleet units.
              </p>
              <ul>
                <li>Standard oil changes</li>
                <li>Additional quarts as needed</li>
                <li>Diesel oil change options</li>
                <li>Routine fluid checks and top-offs</li>
              </ul>
              <div className="otg-callout">
                Great for customers who want basic maintenance completed without the
                time loss of a shop visit.
              </div>
            </div>
          </div>

          <div className="otg-content-split reverse" style={{ marginTop: 40 }}>
            <div className="otg-content-card">
              <h2>
                Preventive <span>Maintenance</span>
              </h2>
              <p>
                Routine service helps catch concerns early and supports safer, more
                reliable vehicle operation.
              </p>
              <ul>
                <li>Fluid level checks</li>
                <li>Service interval recommendations</li>
                <li>Basic under-hood checks</li>
                <li>Fleet maintenance support</li>
              </ul>
              <div className="otg-callout">
                Ideal for staying ahead of common maintenance items before they
                become interruptions.
              </div>
            </div>
            <div className="otg-site-panel">
              <Image
                src="/images/preventive-maintenance.png"
                alt="Preventive maintenance service"
                width={900}
                height={700}
                className="otg-image-fill"
              />
            </div>
          </div>

          <div className="otg-content-split" style={{ marginTop: 40 }}>
            <div className="otg-site-panel">
              <Image
                src="/images/inspection.png"
                alt="Vehicle inspection service"
                width={900}
                height={700}
                className="otg-image-fill"
              />
            </div>
            <div className="otg-content-card">
              <h2>
                Vehicle <span>Inspections</span>
              </h2>
              <p>
                We inspect key wear items and visible systems to help identify
                issues before they turn into larger problems.
              </p>
              <ul>
                <li>Battery checks</li>
                <li>Tire condition review</li>
                <li>Brake inspection</li>
                <li>Visual under-hood inspection</li>
              </ul>
              <div className="otg-callout">
                A strong fit for customers who want a clear picture of current
                vehicle condition and next maintenance needs.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="otg-section otg-section-alt">
        <div className="otg-site-container">
          <div className="otg-section-title-wrap">
            <h2>Service Highlights</h2>
            <p>
              Straightforward mobile support built for everyday use and work-ready
              vehicles.
            </p>
          </div>

          <div className="otg-grid-3">
            <div className="otg-info-card">
              <h3 className="otg-card-title">Personal Vehicles</h3>
              <p>Maintenance for daily drivers without leaving home or work.</p>
            </div>
            <div className="otg-info-card">
              <h3 className="otg-card-title">Work Trucks &amp; Vans</h3>
              <p>Convenient service that helps reduce downtime for working vehicles.</p>
            </div>
            <div className="otg-info-card">
              <h3 className="otg-card-title">Fleet Support</h3>
              <p>Routine maintenance planning for businesses managing multiple units.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="otg-cta">
        <div className="otg-site-container">
          <h2>Ready to Schedule?</h2>
          <p>
            Book maintenance or inspection service and let us bring the work to your
            location.
          </p>
          <Link href="/contact" className="otg-btn otg-btn-primary">
            Request Service
          </Link>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
