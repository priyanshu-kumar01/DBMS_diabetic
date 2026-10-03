import { useFetch } from "../api.js";
import { Select } from "./ui.jsx";

export default function PatientSelect({ value, onChange, allowAll = false, required = false }) {
  const { data } = useFetch("/api/patients");
  const rows = [...(data?.rows || [])].sort((a, b) => a.patient_id - b.patient_id);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{allowAll ? "All patients" : "Select patient…"}</option>
      {rows.map((p) => (
        <option key={p.patient_id} value={p.patient_id}>
          #{p.patient_id} · {p.name} ({p.age}, {String(p.gender)[0]})
        </option>
      ))}
    </Select>
  );
}
