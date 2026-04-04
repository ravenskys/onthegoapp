"use client";

type CustomerContactFieldsProps = {
  firstName: string;
  lastName: string;
  phone: string;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setPhone: (value: string) => void;
  firstNameRequired?: boolean;
  lastNameRequired?: boolean;
  phoneRequired?: boolean;
};

export function CustomerContactFields({
  firstName,
  lastName,
  phone,
  setFirstName,
  setLastName,
  setPhone,
  firstNameRequired = true,
  lastNameRequired = true,
  phoneRequired = true,
}: CustomerContactFieldsProps) {
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
        <input
          type="tel"
          required={phoneRequired}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="otg-input"
          placeholder="(555) 555-5555"
        />
      </div>
    </>
  );
}
