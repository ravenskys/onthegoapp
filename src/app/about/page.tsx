import Image from "next/image";
import Link from "next/link";
import { PublicPageHero } from "@/components/site/PublicPageHero";
import { PublicSiteLayout } from "@/components/site/PublicSiteLayout";

export default function AboutPage() {
  return (
    <PublicSiteLayout activePath="/about">
      <PublicPageHero
        title="About"
        accent="Us"
        body="Built to make routine vehicle care easier for busy drivers, working vehicles, and local businesses that need dependable mobile maintenance."
      />

      <section className="otg-section">
        <div className="otg-site-container otg-content-split">
          <div className="otg-content-card">
            <h2>
              Built Around <span>Convenience</span>
            </h2>
            <p>
              On The Go Maintenance was created to make routine service more
              practical for customers who do not want the downtime and disruption of
              a traditional shop visit.
            </p>
            <p>
              We focus on dependable mobile maintenance for everyday drivers,
              business vehicles, work trucks, and growing fleets that need service
              where they already are.
            </p>
            <p>
              Our approach is simple: honest recommendations, efficient service, and
              maintenance support that helps you stay moving.
            </p>
          </div>

          <div className="otg-site-panel">
            <Image
              src="/images/inspection.png"
              alt="Technician performing vehicle inspection"
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
            <h2>What We Value</h2>
            <p>
              We built the business around service that is practical, dependable,
              and easier to fit into real life.
            </p>
          </div>

          <div className="otg-grid-3">
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Mobile Convenience</h3>
              <p>Routine vehicle care at your home, workplace, or job site.</p>
            </div>
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Straightforward Service</h3>
              <p>Clear recommendations and practical maintenance without the runaround.</p>
            </div>
            <div className="otg-feature-card">
              <h3 className="otg-card-title">Dependable Support</h3>
              <p>Service designed to reduce downtime and keep vehicles usable.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="otg-section">
        <div className="otg-site-container otg-grid-2">
          <div className="otg-highlight-box">
            <h3 className="otg-card-title">Our Mission</h3>
            <p>
              Deliver dependable mobile maintenance that saves customers time and
              helps prevent service interruptions before they grow.
            </p>
          </div>
          <div className="otg-highlight-box">
            <h3 className="otg-card-title">Who We Serve</h3>
            <p>
              Families, busy professionals, contractors, small businesses, and fleet
              owners who want practical vehicle care where they already are.
            </p>
          </div>
        </div>
      </section>

      <section className="otg-cta">
        <div className="otg-site-container">
          <h2>Need Mobile Maintenance?</h2>
          <p>
            Whether you need personal vehicle service or support for working
            vehicles, we can help bring maintenance to you.
          </p>
          <Link href="/contact" className="otg-btn otg-btn-primary">
            Schedule Service
          </Link>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
