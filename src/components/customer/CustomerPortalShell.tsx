"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  BackToPortalButton,
  headerActionButtonClassName,
} from "@/components/portal/BackToPortalButton";
import { PortalTopNav } from "@/components/portal/PortalTopNav";

type CustomerPortalShellProps = {
  title: string;
  subtitle: string;
  onLogout: () => void;
  children: React.ReactNode;
};

export function CustomerPortalShell({
  title,
  subtitle,
  onLogout,
  children,
}: CustomerPortalShellProps) {
  return (
    <div className="otg-page otg-portal-dark">
      <div className="otg-container space-y-6">
        <div className="otg-card overflow-hidden p-0">
          <div className="flex flex-col gap-5 border-b border-lime-500/20 bg-[linear-gradient(135deg,rgba(57,255,20,0.18),rgba(7,17,10,0.88)_35%,rgba(7,17,10,0.96)_100%)] px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="space-y-3">
              <BrandLogo priority className="max-w-[190px] sm:max-w-[220px]" surface="dark" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-lime-50/85">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <BackToPortalButton className="w-full sm:w-auto" />
              <button onClick={onLogout} className={`${headerActionButtonClassName} w-full sm:w-auto`}>
                Log Out
              </button>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 md:px-8">
            <PortalTopNav section="customer" className="!border-lime-500/25 !bg-[#0d1610]" />
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
