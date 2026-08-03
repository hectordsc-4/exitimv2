// API base: mismo origen cuando se sirve desde FastAPI
const API_BASE = window.location.origin.includes("5500")
  ? "http://127.0.0.1:8000"
  : "";

const SESSION_KEY = "exi_session";
