"use client";

import { useState } from "react";
import {
  getEmailInputWarning,
  getPhoneExtensionInputWarning,
  getPhoneInputWarning,
} from "@/lib/input-validation-feedback";

type CustomerContactFieldsProps = {
  firstName: string;
  lastName: string;
  phone: string;
  phoneExtension?: string;
  email?: string;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setPhone: (value: string) => void;
  setPhoneExtension?: (value: string) => void;
  setEmail?: (value: string) => void;
  firstNameRequired?: boolean;
  lastNameRequired?: boolean;
  phoneRequired?: boolean;
  emailRequired?: boolean;
  /** Shown on the email field when `email` / `setEmail` are provided. */
  emailLabel?: string;
};

export function CustomerContactFields({
  firstName,
  lastName,
  phone,
  phoneExtension = "",
  email,
  setFirstName,
  setLastName,
  setPhone,
  setPhoneExtension,
  setEmail,
  firstNameRequired = true,
  lastNameRequired = true,
  phoneRequired = true,
  emailRequired = true,
  emailLabel = "Email",
}: CustomerContactFieldsProps) {
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [extensionHint, setExtensionHint] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-2">
        <label className="otg-label">First Name</label>
        <input
          type="text"
          required={firstNameRequired}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="otg-input"
          placeholder="John"
        />
      </div>

      <div className="space-y-2">
        <label className="otg-label">Last Name</label>
        <input
          type="text"
          required={lastNameRequired}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="otg-input"
          placeholder="Smith"
        />
      </div>

      <div className="space-y-2">
        <label className="otg-label">Phone</label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input
            type="tel"
            required={phoneRequired}
            value={phone}
            onChange={(e) => {
              const raw = e.target.value;
              setPhoneHint(getPhoneInputWarning(raw));
              setPhone(raw);
            }}
            className="otg-input min-w-0 flex-1"
            placeholder="(555) 555-5555"
            autoComplete="tel-national"
          />
          {typeof setPhoneExtension === "function" ? (
            <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-36">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Extension
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={phoneExtension}
                onChange={(e) => {
                  const raw = e.target.value;
                  setExtensionHint(getPhoneExtensionInputWarning(raw));
                  setPhoneExtension(raw);
                }}
                className="otg-input w-full"
                placeholder="Ext."
                autoComplete="tel-extension"
                maxLength={10}
              />
            </div>
          ) : null}
        </div>
        {phoneHint ? (
          <p className="text-xs text-amber-800">{phoneHint}</p>
        ) : null}
        {typeof setPhoneExtension === "function" && extensionHint ? (
          <p className="text-xs text-amber-800">{extensionHint}</p>
        ) : null}
      </div>

      {typeof email === "string" && setEmail ? (
        <div className="space-y-2">
          <label className="otg-label">{emailLabel}</label>
          <input
            type="email"
            required={emailRequired}
            value={email}
            onChange={(e) => {
              const raw = e.target.value;
              setEmailHint(getEmailInputWarning(raw));
              setEmail(raw);
            }}
            className="otg-input"
            placeholder="customer@email.com"
          />
          {emailHint ? (
            <p className="text-xs text-amber-800">{emailHint}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
