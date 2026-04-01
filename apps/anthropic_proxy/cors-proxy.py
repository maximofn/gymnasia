"""
Lightweight CORS proxy for testing the mobile app in browser.
Routes Anthropic API calls through localhost to bypass browser CORS restrictions.

Usage:
    python cors-proxy.py
    # or: uvicorn cors-proxy:app --port 8000

Runs on http://127.0.0.1:8000 (the default EXPO_PUBLIC_API_BASE_URL).
"""

import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

try:
    from fastapi import FastAPI, Request as FRequest
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, StreamingResponse
except ImportError:
    print("Install fastapi + uvicorn: pip install fastapi uvicorn")
    sys.exit(1)

app = FastAPI(title="CORS Proxy")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API = "https://api.anthropic.com"
ANTHROPIC_API_VERSION = "2023-06-01"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/chat/providers/anthropic/verify")
async def anthropic_verify(req: FRequest):
    body = await req.json()
    api_key = body.get("api_key", "")
    model = body.get("model", "claude-3-5-sonnet-latest")

    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
    }
    payload = json.dumps({
        "model": model,
        "max_tokens": 1,
        "messages": [{"role": "user", "content": "hi"}],
    }).encode()

    try:
        r = Request(f"{ANTHROPIC_API}/v1/messages", data=payload, headers=headers, method="POST")
        resp = urlopen(r, timeout=15)
        data = json.loads(resp.read())
        return JSONResponse({"ok": True, "model": data.get("model", model)})
    except HTTPError as e:
        err_body = e.read().decode()
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"error": {"message": err_body}}
        return JSONResponse(err_json, status_code=e.code)
    except Exception as e:
        return JSONResponse({"error": {"message": str(e)}}, status_code=502)


@app.post("/chat/providers/anthropic/messages")
async def anthropic_messages(req: FRequest):
    body = await req.json()
    api_key = body.pop("api_key", "")
    should_stream = bool(body.get("stream"))

    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
    }
    if should_stream:
        headers["accept"] = "text/event-stream"
    payload = json.dumps(body).encode()

    try:
        r = Request(f"{ANTHROPIC_API}/v1/messages", data=payload, headers=headers, method="POST")
        resp = urlopen(r, timeout=120)
        if should_stream:
            def iter_stream():
                try:
                    while True:
                        chunk = resp.read(1024)
                        if not chunk:
                            break
                        yield chunk
                finally:
                    resp.close()

            return StreamingResponse(
                iter_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                },
            )
        data = json.loads(resp.read())
        resp.close()
        return JSONResponse(data)
    except HTTPError as e:
        err_body = e.read().decode()
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"error": {"message": err_body}}
        return JSONResponse(err_json, status_code=e.code)
    except Exception as e:
        return JSONResponse({"error": {"message": str(e)}}, status_code=502)


@app.post("/chat/providers/anthropic/models")
async def anthropic_models(req: FRequest):
    body = await req.json()
    api_key = body.get("api_key", "")

    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_API_VERSION,
    }

    try:
        r = Request(f"{ANTHROPIC_API}/v1/models", headers=headers, method="GET")
        resp = urlopen(r, timeout=15)
        data = json.loads(resp.read())
        return JSONResponse(data)
    except HTTPError as e:
        err_body = e.read().decode()
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"error": {"message": err_body}}
        return JSONResponse(err_json, status_code=e.code)
    except Exception as e:
        return JSONResponse({"error": {"message": str(e)}}, status_code=502)


if __name__ == "__main__":
    import uvicorn
    print("CORS proxy running on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
