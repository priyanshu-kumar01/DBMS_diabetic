import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import PatientHistory from "./pages/PatientHistory.jsx";
import MedicalRecords from "./pages/MedicalRecords.jsx";
import Glucose from "./pages/Glucose.jsx";
import LabReports from "./pages/LabReports.jsx";
import Meals from "./pages/Meals.jsx";
import Activities from "./pages/Activities.jsx";
import Predictions from "./pages/Predictions.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import Reports from "./pages/Reports.jsx";
import Schema from "./pages/Schema.jsx";
import Admin from "./pages/Admin.jsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: "▦" },
  { to: "/patients", label: "Patients", icon: "👤" },
  { to: "/medical-records", label: "Medical Records", icon: "📋" },
  { to: "/glucose", label: "Blood Sugar", icon: "🩸" },
  { to: "/lab-reports", label: "Lab Reports (HbA1c)", icon: "🧪" },
  { to: "/meals", label: "Meals", icon: "🥗" },
  { to: "/activities", label: "Activities", icon: "🏃" },
  { to: "/predictions", label: "Risk Prediction", icon: "⚠️" },
  { to: "/recommendations", label: "Recommendations", icon: "💡" },
  { to: "/reports", label: "SQL Reports", icon: "🗄️" },
  { to: "/schema", label: "ER Diagram & Schema", icon: "🧬" },
  { to: "/admin", label: "Admin", icon: "⚙️" },
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="kicker">DBMS Project</div>
          <div className="title">Diabetes Patient Management</div>
          <div className="sub">&amp; Lifestyle Recommendation System</div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <span className="icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">React · FastAPI · MySQL — 10 relational tables · PK/FK · CHECK · UNIQUE · Indexes · Joins · Aggregates · Subqueries</div>
      </aside>
      <div className="content">
        <header className="topbar">
          <div>
            <b>MCA · Database Management Systems</b> — project demonstration
          </div>
          <div className="pill">Academic demo · risk prediction is rule-based, not a medical diagnosis</div>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientHistory />} />
            <Route path="/medical-records" element={<MedicalRecords />} />
            <Route path="/glucose" element={<Glucose />} />
            <Route path="/lab-reports" element={<LabReports />} />
            <Route path="/meals" element={<Meals />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/schema" element={<Schema />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        <footer className="foot">All data shown is read from and written to MySQL through SQL executed by the FastAPI backend. Sample data is synthetic.</footer>
      </div>
    </div>
  );
}
