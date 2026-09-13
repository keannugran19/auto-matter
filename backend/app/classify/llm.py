"""
llm.py — STAGE 3: LLM-based paragraph classification.

SPEC.md §5: "One call, both documents, one shared taxonomy. Classifying them
separately invites the model to invent divergent label sets that can't be joined."

Requirements (§5):
  - Structured output, schema-constrained, temperature 0.
  - Validate every returned label against the enum. Unrecognised → body.
  - Cache by SHA-256 of file bytes. Same inputs → same result, free on repeat.
  - Every paragraph index must be labelled; fill gaps with the fallback rather
    than failing the job.

API key:
  Read from explicit argument, GOOGLE_API_KEY, GEMINI_API_KEY, or .env file.
  Model preference: gemini-2.0-flash (fast, structured JSON support).
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Optional

import httpx

from .taxonomy import Role, validate, ROLE_ENUM_VALUES
from .fallback import classify as fallback_classify
from ..ooxml.resolver import ResolvedParagraph


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class MissingApiKeyError(Exception):
    """No API key is available for LLM classification."""


class LLMClassificationError(Exception):
    """The LLM call failed or returned unusable output."""


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

_cache: dict[str, list[Role]] = {}


def _cache_key(digest_a: list[dict], digest_b: list[dict]) -> str:
    """SHA-256 of the JSON-serialised digests (both documents)."""
    payload = json.dumps({"a": digest_a, "b": digest_b}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# API Key Discovery
# ---------------------------------------------------------------------------

def resolve_api_key(explicit_key: Optional[str] = None) -> str:
    """
    Resolve the Gemini API key from explicit arg, environment, or .env files.
    """
    if explicit_key and explicit_key.strip():
        return explicit_key.strip()

    # Check environment variables
    for var in ("GOOGLE_API_KEY", "GEMINI_API_KEY"):
        val = os.environ.get(var, "").strip()
        if val:
            return val

    # Check .env files in common locations
    candidates = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.getcwd(), "backend", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
    ]
    for path in candidates:
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        for prefix in ("GOOGLE_API_KEY=", "GEMINI_API_KEY="):
                            if line.startswith(prefix):
                                key_val = line[len(prefix):].strip().strip('"').strip("'")
                                if key_val:
                                    return key_val
            except Exception:
                pass

    return ""


# ---------------------------------------------------------------------------
# Prompt Construction
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a document structure analyst. You receive two DOCX digests: a
REFERENCE document (already correctly formatted) and a TARGET document (to be
reformatted). Classify each paragraph in BOTH documents against the closed
taxonomy below. Return ONLY a JSON object — no prose, no markdown fences.

TAXONOMY (use ONLY these values):
{taxonomy}

RULES:
1. Return exactly one label per paragraph, indexed from 0.
2. If you are uncertain, default to "body" rather than guessing an obscure role.
3. The "role_hint" field is a deterministic prior — trust it for clear cases,
   override it when you are confident the heuristic was wrong.
4. Classify both documents in the SAME call so your labels are consistent.

OUTPUT FORMAT (strict JSON, no extra keys):
{{
  "reference": [{{"index": 0, "role": "series_label"}}, ...],
  "target":    [{{"index": 0, "role": "body"}}, ...]
}}
""".format(taxonomy="\n".join(f"  {v}" for v in ROLE_ENUM_VALUES))


def _build_user_prompt(ref_digests: list[dict], tgt_digests: list[dict]) -> str:
    """
    Build the user-turn prompt with both digests.
    """
    def _fmt(d: dict) -> str:
        return (
            f'  [{d["index"]}] hint={d["role_hint"]!r} '
            f'bold={d["bold_ratio"]:.2f} italic={d["italic_ratio"]:.2f} '
            f'sz={d["size_pt"]}pt list={d["is_list"]} '
            f'outline={d["outline_level"]!r} style={d["style_id"]!r} '
            f'text={d["text_excerpt"][:80]!r}'
        )

    ref_lines = "\n".join(_fmt(d) for d in ref_digests)
    tgt_lines = "\n".join(_fmt(d) for d in tgt_digests)

    return (
        f"REFERENCE ({len(ref_digests)} paragraphs):\n{ref_lines}\n\n"
        f"TARGET ({len(tgt_digests)} paragraphs):\n{tgt_lines}"
    )


# ---------------------------------------------------------------------------
# Response Parsing
# ---------------------------------------------------------------------------

def _parse_response(
    raw: str,
    ref_paras: list[ResolvedParagraph],
    tgt_paras: list[ResolvedParagraph],
) -> tuple[list[Role], list[Role]]:
    """
    Parse the LLM's JSON response into (ref_roles, tgt_roles).
    """
    clean_raw = raw.strip()
    # Strip markdown code fence if model wrapped it
    if clean_raw.startswith("```"):
        lines = clean_raw.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        clean_raw = "\n".join(lines).strip()

    try:
        data = json.loads(clean_raw)
    except json.JSONDecodeError as e:
        raise LLMClassificationError(f"LLM returned invalid JSON: {e}\n{raw[:500]}")

    def _extract(key: str, n_paras: int, paras: list[ResolvedParagraph]) -> list[Role]:
        items = data.get(key, [])
        role_map: dict[int, Role] = {}
        for item in items:
            idx = item.get("index")
            label = item.get("role", "")
            if isinstance(idx, int) and 0 <= idx < n_paras:
                role_map[idx] = validate(label)

        # Fill gaps with fallback
        if len(role_map) < n_paras:
            fallback_roles = fallback_classify(paras)
            for i in range(n_paras):
                if i not in role_map:
                    role_map[i] = fallback_roles[i]

        return [role_map[i] for i in range(n_paras)]

    ref_roles = _extract("reference", len(ref_paras), ref_paras)
    tgt_roles = _extract("target",    len(tgt_paras), tgt_paras)
    return ref_roles, tgt_roles


# ---------------------------------------------------------------------------
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")


# ---------------------------------------------------------------------------
# Gemini API Call via Direct HTTP
# ---------------------------------------------------------------------------

def _call_gemini(
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    model: str = DEFAULT_MODEL,
) -> str:
    """
    Make a single Gemini API call with JSON-mode structured output via HTTP.
    Uses httpx directly without external SDK dependencies.
    Tries primary model and falls back to alternate models if 404/unavailable.
    """
    candidate_models = [model]
    for alt in ("gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-flash-latest"):
        if alt not in candidate_models:
            candidate_models.append(alt)

    payload = {
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
        },
    }

    last_err: Optional[Exception] = None
    for cur_model in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{cur_model}:generateContent?key={api_key}"
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(url, json=payload)
        except Exception as e:
            last_err = LLMClassificationError(f"Network error calling Gemini API with {cur_model}: {e}")
            continue

        if response.status_code == 404:
            last_err = LLMClassificationError(f"Model {cur_model} returned 404: {response.text}")
            continue

        if response.status_code != 200:
            raise LLMClassificationError(
                f"Gemini API error (status {response.status_code}): {response.text}"
            )

        try:
            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise LLMClassificationError(f"No candidates returned by Gemini: {data}")
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                raise LLMClassificationError(f"No content parts in Gemini response: {data}")
            text_parts = [p.get("text", "") for p in parts if "text" in p]
            text = "".join(text_parts).strip()
            if not text:
                raise LLMClassificationError("Gemini returned empty text part")
            return text
        except Exception as e:
            raise LLMClassificationError(f"Failed to parse Gemini response: {e}")

    raise last_err or LLMClassificationError("All candidate Gemini models failed.")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_both(
    ref_digests: list[dict],
    tgt_digests: list[dict],
    ref_paras: list[ResolvedParagraph],
    tgt_paras: list[ResolvedParagraph],
    *,
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    force_fallback: bool = False,
) -> tuple[list[Role], list[Role]]:
    """
    Classify paragraphs in BOTH documents in one LLM call.
    """
    if force_fallback:
        return fallback_classify(ref_paras), fallback_classify(tgt_paras)


    resolved_key = resolve_api_key(api_key)
    if not resolved_key:
        raise MissingApiKeyError(
            "Gemini API key is not configured. Set GOOGLE_API_KEY, GEMINI_API_KEY, "
            "provide a .env file, or pass api_key."
        )

    # Check cache
    cache_key = _cache_key(ref_digests, tgt_digests)
    if cache_key in _cache:
        cached = _cache[cache_key]
        n_ref = len(ref_paras)
        return cached[:n_ref], cached[n_ref:]

    user_prompt = _build_user_prompt(ref_digests, tgt_digests)
    raw = _call_gemini(_SYSTEM_PROMPT, user_prompt, resolved_key, model)
    ref_roles, tgt_roles = _parse_response(raw, ref_paras, tgt_paras)

    # Cache: store concatenated lists
    _cache[cache_key] = ref_roles + tgt_roles

    return ref_roles, tgt_roles


def clear_cache() -> None:
    """Clear the in-memory classification cache."""
    _cache.clear()
