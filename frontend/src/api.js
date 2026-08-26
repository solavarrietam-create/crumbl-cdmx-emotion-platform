const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
const API_HOST = window.location.hostname || "127.0.0.1";
const API_BASE = configuredApiUrl || `http://${API_HOST}:8000`;

export async function fetchGraph({ lang, week }) {
  const params = new URLSearchParams({ lang });
  if (week) params.set("week", week);

  const res = await fetch(`${API_BASE}/v1/graph?${params.toString()}`);
  if (!res.ok) {
    throw new Error("No se pudo cargar el grafo.");
  }
  return res.json();
}

export async function fetchReading(week) {
  const res = await fetch(`${API_BASE}/v1/readings/${week}`);
  if (!res.ok) {
    throw new Error("No se pudo cargar la lectura semanal.");
  }
  return res.json();
}

export async function updateEdgeWeight({ edgeId, week, value, actor = "ui", source = "manual" }) {
  const res = await fetch(`${API_BASE}/v1/edges/${edgeId}/weights/${week}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ value, actor, source })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error al actualizar peso: ${text}`);
  }

  return res.json();
}
