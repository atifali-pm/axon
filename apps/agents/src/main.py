from fastapi import FastAPI

app = FastAPI(title="Axon Agents", version="0.0.1")


@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "agents"}
