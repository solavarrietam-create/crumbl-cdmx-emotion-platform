# Crumbl CDMX — Emotion Graph Platform

Plataforma de visualización del mapa emocional 3D para la apertura de Crumbl Cookies CDMX (semana 2026-W35).

## Incluye

- API FastAPI para consulta de grafo y lectura semanal.
- Frontend React + ForceGraph3D con renderizado de emojis por matiz e intensidad.
- Soporte bilingüe completo (Español / Inglés).
- Datos de campo de TikTok e Instagram (97 piezas clasificadas).

## Ejecución local

1. Activar entorno virtual e instalar dependencias de backend:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

2. Iniciar API:
```powershell
uvicorn backend.app.main:app --port 8000 --reload
```

3. Iniciar frontend:
```powershell
cd frontend
npm install
npm run dev
```
