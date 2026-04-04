import Image from "next/image";
import Link from "next/link";
import { PublicSiteLayout } from "@/components/site/PublicSiteLayout";

export default function HomePage() {
  return (
    <PublicSiteLayout activePath="/">
      <section className="otg-hero">
        <div className="otg-site-container otg-hero-wrap">
          <div>
            <h1>
              Keeping You Moving, <span>Wherever You Are</span>
            </h1>
            <p>
              Mobile automotive maintenance for personal vehicles and fleet
              accounts. We bring dependable service directly to your home,
              workplace, or job site, helping you save time and reduce downtime.
            </p>

            <div className="otg-hero-buttons">
              <Link href="/contact" className="otg-btn otg-btn-primary">
                Schedule Service
              </Link>
              <Link href="/services" className="otg-btn otg-btn-outline-dark">
                View Services
              </Link>
              <Link href="/portal" className="otg-btn otg-btn-outline-dark">
                Portal Access
              </Link>
            </div>
          </div>

          <div className="otg-hero-card">
            <h3>Why Customers Choose Us</h3>
            <ul>
              <li>Mobile service at your location</li>
              <li>Personal and fleet vehicle maintenance</li>
              <li>Oil changes, fluid services, and inspections</li>
              <li>Gas and diesel vehicle support</li>
              <li>Convenient scheduling</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="otg-section">
        <div className="otg-site-container">
          <div className="otg-section-title-wrap">
            <h2>Our Services</h2>
            <p>
              Reliable maintenance designed to keep vehicles road-ready with less
              hassle and less interruption to your day.
            </p>
          </div>

          <div className="otg-grid-3">
            <article className="otg-service-card">
              <Image
                src="/images/oil-change.png"
                alt="Oil change and fluid service"
                width={600}
                height={440}
                className="otg-service-thumbnail"
              />
              <h3 className="otg-card-title">Oil Changes &amp; Fluid Services</h3>
              <p>
                Convenient on-site oil changes and essential fluid maintenance
                for both personal and work vehicles.
              </p>
              <ul>
                <li>Standard oil changes</li>
                <li>Up to 5 quarts available</li>
                <li>Additional quarts as needed</li>
                <li>Diesel oil change options</li>
              </ul>
            </article>

            <article className="otg-service-card">
              <Image
                src="/images/preventive-maintenance.png"
                alt="Preventive maintenance service"
                width={600}
                height={440}
                className="otg-service-thumbnail"
              />
              <h3 className="otg-card-title">Preventive Maintenance</h3>
              <p>
                Routine service helps catch issues early and keeps your vehicle
                running safely and reliably.
              </p>
              <ul>
                <li>Fluid checks</li>
                <li>Basic inspections</li>
                <li>Service interval recommendations</li>
                <li>Fleet maintenance support</li>
              </ul>
            </article>

            <article className="otg-service-card">
              <Image
                src="/images/inspection.png"
                alt="Vehicle inspection service"
                width={600}
                height={440}
                className="otg-service-thumbnail"
              />
              <h3 className="otg-card-title">Vehicle Inspections</h3>
              <p>
                We check key systems and visible wear items to help identify
                maintenance concerns before they become bigger problems.
              </p>
              <ul>
                <li>Battery checks</li>
                <li>Tire condition review</li>
                <li>Brake inspection</li>
                <li>Visual under-hood inspection</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="otg-section otg-section-alt">
        <div className="otg-site-container otg-content-split">
          <div className="otg-content-card">
            <h2>
              About <span>On The Go</span>
            </h2>
            <p>
              On The Go Maintenance is a mobile automotive maintenance service
              built to make routine vehicle care easier for busy drivers,
              families, contractors, small businesses, and fleet owners.
            </p>
            <p>
              We bring dependable, professional maintenance directly to your
              location, helping you avoid shop wait times and keep your vehicle
              in service.
            </p>
            <p>
              Whether it is a personal vehicle, work truck, van, or fleet unit,
              our goal is to deliver honest service, save you time, and keep you
              moving.
            </p>
          </div>

          <div className="otg-grid-2">
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Mobile Convenience</h3>
              <p>We come to your home, work, or job site.</p>
            </div>
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Fleet &amp; Personal</h3>
              <p>Service built for both businesses and everyday drivers.</p>
            </div>
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Dependable Care</h3>
              <p>Focused on honest work and reliable maintenance.</p>
            </div>
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Less Downtime</h3>
              <p>Keep vehicles on the road and your day on track.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="otg-cta">
        <div className="otg-site-container">
          <h2>Ready to Book Mobile Service?</h2>
          <p>
            Schedule maintenance for your personal vehicle or fleet and let us
            bring dependable service directly to you.
          </p>
          <Link href="/contact" className="otg-btn otg-btn-primary">
            Book an Appointment
          </Link>
        </div>
      </section>

      <section className="otg-section otg-section-alt">
        <div className="otg-site-container">
          <div className="otg-section-title-wrap">
            <h2>Schedule Service</h2>
            <p>
              Reach out to book mobile maintenance, inspections, or fleet
              support.
            </p>
          </div>

          <div className="otg-grid-2">
            <div className="otg-contact-card">
              <h3 className="otg-card-title">Contact Information</h3>
              <p>Phone: 208-410-9470</p>
              <p>Email: onthegomaint@gmail.com</p>
              <p>
                Saturday - Sunday: 9:00 AM - 7:00 PM
                <br />
                Monday - Thursday: 4:30 PM - 7:00 PM
                <br />
                Friday: Closed
              </p>
            </div>

            <div className="otg-contact-card">
              <h3 className="otg-card-title">Choose Your Next Step</h3>
              <p>
                Use the public booking page for service requests or jump into the
                portal if you already have access.
              </p>
              <div className="otg-button-row">
                <Link href="/contact" className="otg-btn otg-btn-primary">
                  Request Appointment
                </Link>
                <Link href="/portal" className="otg-btn otg-btn-secondary">
                  Open Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
