export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-md">
        <h1 className="text-3xl font-bold text-slate-900">OnTheGo Maintenance</h1>
        <p className="mt-3 text-slate-600">Select your portal.</p>

        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href="/customer/login"
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Customer Portal
          </a>

          <a
            href="/tech"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Technician Portal
          </a>
        </div>
      </div>
    </div>
  );
}