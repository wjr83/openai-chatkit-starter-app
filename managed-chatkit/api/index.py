"""Vercel Python serverless function: exchange workflow ids for ChatKit client secrets."""

from __future__ import annotations

import json
import os
import uuid
from typing import Any, Mapping

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

DEFAULT_CHATKIT_BASE = "https://api.openai.com"
SESSION_COOKIE_NAME = "chatkit_session_id"
SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30 days

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/create-session")
async def create_session(request: Request) -> JSONResponse:
    """Exchange a workflow id for a ChatKit client secret."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _respond({"error": "Missing OPENAI_API_KEY environment variable"}, 500)

    body = await _read_json_body(request)
    workflow_id = _resolve_workflow_id(body)
    if not workflow_id:
        return _respond({"error": "Missing workflow id"}, 400)

    workflow_version = _resolve_workflow_version(body)
    user_id, cookie_value = _resolve_user(request.cookies)
    api_base = _chatkit_api_base()

    workflow_payload: dict[str, str] = {"id": workflow_id}
    if workflow_version:
        workflow_payload["version"] = workflow_version

    try:
        async with httpx.AsyncClient(base_url=api_base, timeout=10.0) as client:
            upstream = await client.post(
                "/v1/chatkit/sessions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "OpenAI-Beta": "chatkit_beta=v1",
                    "Content-Type": "application/json",
                },
                json={"workflow": workflow_payload, "user": user_id},
            )
    except httpx.RequestError as error:
        return _respond(
            {"error": f"Failed to reach ChatKit API: {error}"},
            502,
            cookie_value,
        )

    payload = _parse_json(upstream)
    if not upstream.is_success:
        message = None
        if isinstance(payload, Mapping):
            message = payload.get("error")
        message = message or upstream.reason_phrase or "Failed to create session"
        return _respond({"error": message}, upstream.status_code, cookie_value)

    client_secret = None
    expires_after = None
    if isinstance(payload, Mapping):
        client_secret = payload.get("client_secret")
        expires_after = payload.get("expires_after")

    if not client_secret:
        return _respond(
            {"error": "Missing client secret in response"},
            502,
            cookie_value,
        )

    return _respond(
        {"client_secret": client_secret, "expires_after": expires_after},
        200,
        cookie_value,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _respond(
    payload: Mapping[str, Any], status_code: int, cookie_value: str | None = None
) -> JSONResponse:
    response = JSONResponse(payload, status_code=status_code)
    if cookie_value:
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=cookie_value,
            max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
            httponly=True,
            samesite="lax",
            secure=_is_prod(),
            path="/",
        )
    return response


def _is_prod() -> bool:
    env = (
        os.getenv("VERCEL_ENV")
        or os.getenv("ENVIRONMENT")
        or os.getenv("NODE_ENV")
        or ""
    ).lower()
    return env == "production"


async def _read_json_body(request: Request) -> Mapping[str, Any]:
    raw = await request.body()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, Mapping) else {}


def _resolve_workflow_id(body: Mapping[str, Any]) -> str | None:
    workflow = body.get("workflow", {})
    workflow_id = None
    if isinstance(workflow, Mapping):
        workflow_id = workflow.get("id")
    workflow_id = workflow_id or body.get("workflowId")
    env_workflow = os.getenv("CHATKIT_WORKFLOW_ID") or os.getenv(
        "VITE_CHATKIT_WORKFLOW_ID"
    )
    if not workflow_id and env_workflow:
        workflow_id = env_workflow
    if workflow_id and isinstance(workflow_id, str) and workflow_id.strip():
        return workflow_id.strip()
    return None


def _resolve_workflow_version(body: Mapping[str, Any]) -> str | None:
    workflow = body.get("workflow", {})
    version = None
    if isinstance(workflow, Mapping):
        version = workflow.get("version")
    env_version = os.getenv("CHATKIT_WORKFLOW_VERSION") or os.getenv(
        "VITE_CHATKIT_WORKFLOW_VERSION"
    )
    if not version and env_version:
        version = env_version
    if version and isinstance(version, str) and version.strip():
        return version.strip()
    return None


def _resolve_user(cookies: Mapping[str, str]) -> tuple[str, str | None]:
    existing = cookies.get(SESSION_COOKIE_NAME)
    if existing:
        return existing, None
    user_id = str(uuid.uuid4())
    return user_id, user_id


def _chatkit_api_base() -> str:
    return (
        os.getenv("CHATKIT_API_BASE")
        or os.getenv("VITE_CHATKIT_API_BASE")
        or DEFAULT_CHATKIT_BASE
    )


def _parse_json(response: httpx.Response) -> Mapping[str, Any]:
    try:
        parsed = response.json()
        return parsed if isinstance(parsed, Mapping) else {}
    except (json.JSONDecodeError, httpx.DecodingError):
        return {}
