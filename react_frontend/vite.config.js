import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// React front-end (JavaScript). API base URL comes from .env (VITE_API_URL).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
