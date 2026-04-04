type PublicPageHeroProps = {
  title: string;
  accent?: string;
  body: string;
};

export function PublicPageHero({ title, accent, body }: PublicPageHeroProps) {
  return (
    <section className="otg-page-hero">
      <div className="otg-site-container">
        <h1>
          {title} {accent ? <span>{accent}</span> : null}
        </h1>
        <p>{body}</p>
      </div>
    </section>
  );
}
