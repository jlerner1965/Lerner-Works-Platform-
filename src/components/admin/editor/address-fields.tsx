"use client";

import { TextInput, Checkbox } from "@/components/admin/editor/inputs";
import type { Address } from "@/modules/common";
import type { Issues } from "@/components/admin/editor/types";

export function AddressFields({ value, onChange, issues, prefix }: { value: Address; onChange: (a: Address) => void; issues: Issues; prefix: string }) {
  return (
    <div className="grid gap-x-3 sm:grid-cols-2">
      <TextInput label="Address line 1" value={value.line1} onChange={(v) => onChange({ ...value, line1: v })} error={issues[`${prefix}.line1`]} />
      <TextInput label="Address line 2" value={value.line2} onChange={(v) => onChange({ ...value, line2: v })} />
      <TextInput label="City / locality" value={value.locality} onChange={(v) => onChange({ ...value, locality: v })} />
      <TextInput label="State / region" value={value.region} onChange={(v) => onChange({ ...value, region: v })} />
      <TextInput label="Postal code" value={value.postalCode} onChange={(v) => onChange({ ...value, postalCode: v })} />
      <div className="sm:col-span-2">
        <Checkbox label="Address approved by the owner for public direction links" checked={value.approved} onChange={(v) => onChange({ ...value, approved: v })} hint="Direction links are generated only from approved addresses on live sites." />
      </div>
    </div>
  );
}
