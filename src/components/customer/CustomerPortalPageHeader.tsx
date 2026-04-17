"use client";

import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";

type CustomerPortalPageHeaderProps = {
  title: string;
  subtitle: string;
  onLogout: () => void;
};

/** Page title + account actions; matches public site typography and card styling. */
export function CustomerPortalPageHeader({
  title,
  subtitle,
  onLogout,
}: CustomerPortalPageHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{subtitle}</p>
        </div>
        <div className="flex w-full flex-shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <BackToPortalButton className="w-full sm:w-auto" />
          <button
            type="button"
            onClick={onLogout}
            className={`${headerActionButtonClassName} w-full sm:w-auto`}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
