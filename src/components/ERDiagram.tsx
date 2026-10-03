"use client";

/**
 * Hand-drawn SVG ER diagram (crow's-foot style, 1 : N).
 * PATIENT is the central strong entity; MEAL and ACTIVITY are independent
 * master entities linked through the associative tables.
 */
interface Attr { n: string; k?: "PK" | "FK" | "UK" }
interface Entity { name: string; x: number; y: number; w: number; attrs: Attr[]; master?: boolean }

const ENTITIES: Entity[] = [
  { name: "medical_record", x: 20, y: 20, w: 270, attrs: [{ n: "record_id", k: "PK" }, { n: "patient_id", k: "FK" }, { n: "medical_history" }, { n: "existing_conditions" }, { n: "medications" }, { n: "record_date" }] },
  { name: "blood_sugar_record", x: 340, y: 20, w: 270, attrs: [{ n: "sugar_record_id", k: "PK" }, { n: "patient_id", k: "FK" }, { n: "glucose_level" }, { n: "measurement_type" }, { n: "record_date" }] },
  { name: "lab_report", x: 660, y: 20, w: 270, attrs: [{ n: "lab_id", k: "PK" }, { n: "patient_id", k: "FK" }, { n: "hba1c" }, { n: "bp_systolic" }, { n: "bp_diastolic" }, { n: "report_date" }] },
  { name: "prediction", x: 980, y: 20, w: 270, attrs: [{ n: "prediction_id", k: "PK" }, { n: "patient_id", k: "FK" }, { n: "risk_level" }, { n: "risk_score" }, { n: "remarks" }, { n: "prediction_date" }] },
  { name: "meal", x: 20, y: 330, w: 270, master: true, attrs: [{ n: "meal_id", k: "PK" }, { n: "meal_name", k: "UK" }, { n: "meal_type" }, { n: "calories" }, { n: "carbohydrates" }, { n: "description" }] },
  { name: "patient", x: 470, y: 300, w: 330, attrs: [{ n: "patient_id", k: "PK" }, { n: "name" }, { n: "age" }, { n: "gender" }, { n: "phone", k: "UK" }, { n: "email", k: "UK" }, { n: "height" }, { n: "weight" }, { n: "bmi  (derived)" }] },
  { name: "recommendation", x: 980, y: 330, w: 270, attrs: [{ n: "recommendation_id", k: "PK" }, { n: "patient_id", k: "FK" }, { n: "recommendation_type" }, { n: "recommendation_text" }, { n: "recommendation_date" }] },
  { name: "meal_record", x: 340, y: 640, w: 270, attrs: [{ n: "meal_record_id", k: "PK" }, { n: "patient_id", k: "FK" }, { n: "meal_id", k: "FK" }, { n: "meal_date" }, { n: "status" }] },
  { name: "activity_record", x: 660, y: 640, w: 270, attrs: [{ n: "activity_record_id", k: "PK" }, { n: "patient_id", k: "FK" }, { n: "activity_id", k: "FK" }, { n: "duration" }, { n: "steps" }, { n: "activity_date" }] },
  { name: "activity", x: 980, y: 640, w: 270, master: true, attrs: [{ n: "activity_id", k: "PK" }, { n: "activity_name", k: "UK" }, { n: "activity_type" }, { n: "recommended_duration" }, { n: "description" }] },
];

const RELATIONS: { from: string; to: string; label: string }[] = [
  { from: "patient", to: "medical_record", label: "has" },
  { from: "patient", to: "blood_sugar_record", label: "records" },
  { from: "patient", to: "lab_report", label: "receives" },
  { from: "patient", to: "prediction", label: "assessed by" },
  { from: "patient", to: "recommendation", label: "receives" },
  { from: "patient", to: "meal_record", label: "logs" },
  { from: "patient", to: "activity_record", label: "performs" },
  { from: "meal", to: "meal_record", label: "appears in" },
  { from: "activity", to: "activity_record", label: "appears in" },
];

const ROW = 17;
const HEAD = 28;
const height = (e: Entity) => HEAD + e.attrs.length * ROW + 10;
const center = (e: Entity) => ({ cx: e.x + e.w / 2, cy: e.y + height(e) / 2 });

export default function ERDiagram() {
  const byName = Object.fromEntries(ENTITIES.map((e) => [e.name, e]));
  return (
    <svg viewBox="0 0 1270 830" className="h-auto w-full rounded-lg border border-slate-200 bg-white" role="img" aria-label="ER diagram">
      <defs>
        <marker id="crow" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto">
          <path d="M1,1 L13,7 L1,13 M13,7 L1,7" fill="none" stroke="#0f766e" strokeWidth="1.4" />
        </marker>
      </defs>
      {RELATIONS.map((r) => {
        const a = center(byName[r.from]);
        const b = center(byName[r.to]);
        const lx = a.cx + (b.cx - a.cx) * 0.5;
        const ly = a.cy + (b.cy - a.cy) * 0.5;
        const p1x = a.cx + (b.cx - a.cx) * 0.3;
        const p1y = a.cy + (b.cy - a.cy) * 0.3;
        const pNx = a.cx + (b.cx - a.cx) * 0.72;
        const pNy = a.cy + (b.cy - a.cy) * 0.72;
        return (
          <g key={`${r.from}-${r.to}`}>
            <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke="#0f766e" strokeWidth="1.5" markerEnd="url(#crow)" />
            <rect x={lx - 34} y={ly - 9} width="68" height="18" rx="9" fill="#ecfeff" stroke="#0f766e" strokeWidth="0.8" />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize="10" fill="#134e4a">{r.label}</text>
            <text x={p1x} y={p1y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f766e">1</text>
            <text x={pNx} y={pNy - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f766e">N</text>
          </g>
        );
      })}
      {ENTITIES.map((e) => {
        const h = height(e);
        const isPatient = e.name === "patient";
        return (
          <g key={e.name}>
            <rect x={e.x} y={e.y} width={e.w} height={h} rx="8" fill="#ffffff" stroke={isPatient ? "#0f766e" : e.master ? "#b45309" : "#334155"} strokeWidth={isPatient ? 2.5 : 1.4} />
            <rect x={e.x} y={e.y} width={e.w} height={HEAD} rx="8" fill={isPatient ? "#0f766e" : e.master ? "#b45309" : "#334155"} />
            <rect x={e.x} y={e.y + HEAD - 8} width={e.w} height={8} fill={isPatient ? "#0f766e" : e.master ? "#b45309" : "#334155"} />
            <text x={e.x + e.w / 2} y={e.y + 19} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="ui-monospace, monospace">{e.name}{e.master ? "  (master)" : ""}</text>
            {e.attrs.map((a, i) => (
              <g key={a.n}>
                <text x={e.x + 12} y={e.y + HEAD + 13 + i * ROW} fontSize="11.5" fill="#0f172a" fontFamily="ui-monospace, monospace" textDecoration={a.k === "PK" ? "underline" : undefined} fontStyle={a.k === "FK" ? "italic" : undefined}>{a.n}</text>
                {a.k && <text x={e.x + e.w - 12} y={e.y + HEAD + 13 + i * ROW} textAnchor="end" fontSize="10" fontWeight="700" fill={a.k === "PK" ? "#b91c1c" : a.k === "FK" ? "#1d4ed8" : "#7c3aed"}>{a.k}</text>}
              </g>
            ))}
          </g>
        );
      })}
      <g fontSize="11" fill="#334155">
        <text x="20" y="815">Legend: <tspan fill="#b91c1c" fontWeight="700">PK</tspan> primary key (underlined) · <tspan fill="#1d4ed8" fontWeight="700">FK</tspan> foreign key (italic) · <tspan fill="#7c3aed" fontWeight="700">UK</tspan> unique · crow&apos;s foot = many side · 1 : N relationships</text>
      </g>
    </svg>
  );
}
