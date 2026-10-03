"use client";

import { useFetch } from "@/lib/client";
import { Select } from "@/components/ui";

interface PatientLite extends Record<string, unknown> {
  patientId: number;
  name: string;
  age: number;
  gender: string;
}

export default function PatientSelect({ value, onChange, allowAll = false, required }: { value: string; onChange: (v: string) => void; allowAll?: boolean; required?: boolean }) {
  const { data } = useFetch<{ rows: PatientLite[] }>("/api/patients");
  const rows = [...(data?.rows ?? [])].sort((a, b) => a.patientId - b.patientId);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{allowAll ? "All patients" : "Select patient…"}</option>
      {rows.map((p) => (
        <option key={p.patientId} value={p.patientId}>
          #{p.patientId} · {p.name} ({p.age}, {p.gender[0]})
        </option>
      ))}
    </Select>
  );
}
