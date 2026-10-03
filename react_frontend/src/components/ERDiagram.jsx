// SVG ER diagram (crow's-foot, 1 : N). PATIENT is the central strong entity;
// MEAL and ACTIVITY are master entities linked through associative tables.
const ENTITIES = [
  { name: "medical_record", x: 20, y: 20, w: 270, attrs: [["record_id", "PK"], ["patient_id", "FK"], ["medical_history"], ["existing_conditions"], ["medications"], ["record_date"]] },
  { name: "blood_sugar_record", x: 340, y: 20, w: 270, attrs: [["sugar_record_id", "PK"], ["patient_id", "FK"], ["glucose_level"], ["measurement_type"], ["record_date"]] },
  { name: "lab_report", x: 660, y: 20, w: 270, attrs: [["lab_id", "PK"], ["patient_id", "FK"], ["hba1c"], ["bp_systolic"], ["bp_diastolic"], ["report_date"]] },
  { name: "prediction", x: 980, y: 20, w: 270, attrs: [["prediction_id", "PK"], ["patient_id", "FK"], ["risk_level"], ["risk_score"], ["remarks"], ["prediction_date"]] },
  { name: "meal", x: 20, y: 330, w: 270, master: true, attrs: [["meal_id", "PK"], ["meal_name", "UK"], ["meal_type"], ["calories"], ["carbohydrates"], ["description"]] },
  { name: "patient", x: 470, y: 300, w: 330, attrs: [["patient_id", "PK"], ["name"], ["age"], ["gender"], ["phone", "UK"], ["email", "UK"], ["height"], ["weight"], ["bmi  (derived)"]] },
  { name: "recommendation", x: 980, y: 330, w: 270, attrs: [["recommendation_id", "PK"], ["patient_id", "FK"], ["recommendation_type"], ["recommendation_text"], ["recommendation_date"]] },
  { name: "meal_record", x: 340, y: 640, w: 270, attrs: [["meal_record_id", "PK"], ["patient_id", "FK"], ["meal_id", "FK"], ["meal_date"], ["status"]] },
  { name: "activity_record", x: 660, y: 640, w: 270, attrs: [["activity_record_id", "PK"], ["patient_id", "FK"], ["activity_id", "FK"], ["duration"], ["steps"], ["activity_date"]] },
  { name: "activity", x: 980, y: 640, w: 270, master: true, attrs: [["activity_id", "PK"], ["activity_name", "UK"], ["activity_type"], ["recommended_duration"], ["description"]] },
];
const RELATIONS = [
  ["patient", "medical_record", "has"], ["patient", "blood_sugar_record", "records"], ["patient", "lab_report", "receives"],
  ["patient", "prediction", "assessed by"], ["patient", "recommendation", "receives"], ["patient", "meal_record", "logs"],
  ["patient", "activity_record", "performs"], ["meal", "meal_record", "appears in"], ["activity", "activity_record", "appears in"],
];
const ROW = 17;
const HEAD = 28;
const height = (e) => HEAD + e.attrs.length * ROW + 10;
const center = (e) => ({ cx: e.x + e.w / 2, cy: e.y + height(e) / 2 });
const KEY_COLOR = { PK: "#b91c1c", FK: "#1d4ed8", UK: "#7c3aed" };

export default function ERDiagram() {
  const byName = Object.fromEntries(ENTITIES.map((e) => [e.name, e]));
  return (
    <svg viewBox="0 0 1270 830" style={{ width: "100%", height: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }} role="img" aria-label="ER diagram">
      <defs>
        <marker id="crow" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto">
          <path d="M1,1 L13,7 L1,13 M13,7 L1,7" fill="none" stroke="#0f766e" strokeWidth="1.4" />
        </marker>
      </defs>
      {RELATIONS.map(([from, to, label]) => {
        const a = center(byName[from]);
        const b = center(byName[to]);
        const mid = (t) => ({ x: a.cx + (b.cx - a.cx) * t, y: a.cy + (b.cy - a.cy) * t });
        const l = mid(0.5), one = mid(0.3), many = mid(0.72);
        return (
          <g key={`${from}-${to}`}>
            <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke="#0f766e" strokeWidth="1.5" markerEnd="url(#crow)" />
            <rect x={l.x - 34} y={l.y - 9} width="68" height="18" rx="9" fill="#ecfeff" stroke="#0f766e" strokeWidth="0.8" />
            <text x={l.x} y={l.y + 4} textAnchor="middle" fontSize="10" fill="#134e4a">{label}</text>
            <text x={one.x} y={one.y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f766e">1</text>
            <text x={many.x} y={many.y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f766e">N</text>
          </g>
        );
      })}
      {ENTITIES.map((e) => {
        const h = height(e);
        const color = e.name === "patient" ? "#0f766e" : e.master ? "#b45309" : "#334155";
        return (
          <g key={e.name}>
            <rect x={e.x} y={e.y} width={e.w} height={h} rx="8" fill="#fff" stroke={color} strokeWidth={e.name === "patient" ? 2.5 : 1.4} />
            <rect x={e.x} y={e.y} width={e.w} height={HEAD} rx="8" fill={color} />
            <rect x={e.x} y={e.y + HEAD - 8} width={e.w} height={8} fill={color} />
            <text x={e.x + e.w / 2} y={e.y + 19} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="ui-monospace, monospace">
              {e.name}{e.master ? "  (master)" : ""}
            </text>
            {e.attrs.map(([name, key], i) => (
              <g key={name}>
                <text x={e.x + 12} y={e.y + HEAD + 13 + i * ROW} fontSize="11.5" fill="#0f172a" fontFamily="ui-monospace, monospace" textDecoration={key === "PK" ? "underline" : undefined} fontStyle={key === "FK" ? "italic" : undefined}>{name}</text>
                {key && <text x={e.x + e.w - 12} y={e.y + HEAD + 13 + i * ROW} textAnchor="end" fontSize="10" fontWeight="700" fill={KEY_COLOR[key]}>{key}</text>}
              </g>
            ))}
          </g>
        );
      })}
      <text x="20" y="815" fontSize="11" fill="#334155">
        Legend: PK primary key (underlined) · FK foreign key (italic) · UK unique · crow&apos;s foot = many side · 1 : N relationships
      </text>
    </svg>
  );
}
