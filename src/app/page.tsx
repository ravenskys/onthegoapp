export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-12">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-md">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          OnTheGo Maintenance
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Portal Home
        </h1>
        <p className="mt-2 text-slate-600">
          Choose where you want to go.
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href="/customer/login"
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Customer Portal
          </a>

          <a
            href="/tech"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Technician Portal
          </a>

          <a
            href="/manager"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Manager Portal
          </a>

          <a
            href="/admin"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Admin Portal
          </a>
        </div>
      </div>
    </div>
  );
}