import base64
import json
import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from elevenlabs.client import ElevenLabs


MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")


class DocumentAnalysis(BaseModel):
    purpose: str
    summary: str
    transcribedText: str
    requirements: List[str]


class AnalyzeRequest(BaseModel):
    content: str
    is_image: bool = Field(default=False)
    mime_type: str = Field(default="text/plain")
    target_language: str = Field(default="English")


class SimplifyRequest(BaseModel):
    selected_text: str
    analysis: DocumentAnalysis
    target_language: str = Field(default="English")


class SimplifyResponse(BaseModel):
    explanation: str
    keyTerms: List[str]
    translatedText: str
    translatedLanguage: str


class TtsRequest(BaseModel):
    text: str
    language: str = Field(default="English")


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {
        "status": "ok",
        "message": "Backend is running. Use /api/analyze or /api/simplify.",
    }


def get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set.")
    return genai.Client(api_key=api_key)


def get_elevenlabs_config() -> tuple[str, str]:
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
    if not api_key or not voice_id:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is not set.")
    return api_key, voice_id


def get_elevenlabs_client() -> ElevenLabs:
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY is not set.")
    return ElevenLabs(api_key=api_key)


def parse_json_response(response_text: Optional[str]) -> dict:
    if not response_text:
        raise HTTPException(status_code=502, detail="Empty response from Gemini.")
    try:
        return json.loads(response_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Invalid JSON from Gemini.") from exc


def build_analysis_prompt(file_content: Optional[str], target_language: str) -> str:
    base_prompt = f"""
You are an expert in simplifying bureaucratic, legal, and government forms.
Analyze the following document content.

Tasks:
1. Transcribe the full text content accurately if it's an image. If it's already text, just use it.
2. Provide a clear, simple 1-sentence purpose in {target_language}.
3. Provide a short paragraph summary in {target_language}.
4. List the key requirements or action items in {target_language} (e.g., "Submit by date X", "Attach ID").

Return the response in JSON format.
"""

    if not file_content:
        return base_prompt

    return f"""{base_prompt}

DOCUMENT CONTENT:
{file_content}
"""


def build_simplify_prompt(selected_text: str, analysis: DocumentAnalysis) -> str:
    trimmed_selection = selected_text.strip()
    transcript = analysis.transcribedText or ""
    lower_transcript = transcript.lower()
    lower_selection = trimmed_selection.lower()
    match_index = lower_transcript.find(lower_selection) if lower_selection else -1
    context_window = 500

    if match_index >= 0:
        start = max(0, match_index - context_window)
        end = min(len(transcript), match_index + len(lower_selection) + context_window)
        context_snippet = transcript[start:end]
    else:
        context_snippet = transcript[:1200] if transcript else ""

    requirements_list = (
        "\n".join(f"{idx + 1}. {req}" for idx, req in enumerate(analysis.requirements))
        if analysis.requirements
        else "None provided."
    )

    return f"""
The user is reading a bureaucratic document and is confused by this specific text: "{trimmed_selection}".

Document context (use this to interpret the selection accurately):
Purpose: {analysis.purpose}
Summary: {analysis.summary}
Key requirements:
{requirements_list}

Relevant excerpt from the document:
{context_snippet or "No excerpt available."}

Task:
1. Explain the selected text in extremely simple, plain English terms.
2. Identify 1-3 specific legal/complex terms in the selection and define them simply.
"""


@app.post("/api/analyze", response_model=DocumentAnalysis)
def analyze_document(payload: AnalyzeRequest) -> DocumentAnalysis:
    prompt = build_analysis_prompt(None if payload.is_image else payload.content, payload.target_language)
    client = get_client()

    if payload.is_image:
        data = payload.content
        if "," in data:
            data = data.split(",", 1)[1]
        image_bytes = base64.b64decode(data)
        contents = [
            types.Content(
                parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type=payload.mime_type),
                    types.Part.from_text(prompt),
                ]
            )
        ]
    else:
        contents = prompt

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema={
                "type": "object",
                "properties": {
                    "purpose": {"type": "string"},
                    "summary": {"type": "string"},
                    "transcribedText": {"type": "string"},
                    "requirements": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["purpose", "summary", "transcribedText", "requirements"],
            },
        ),
    )

    result = parse_json_response(getattr(response, "text", None))
    return DocumentAnalysis(**result)


@app.post("/api/simplify", response_model=SimplifyResponse)
def simplify_text(payload: SimplifyRequest) -> SimplifyResponse:
    prompt = build_simplify_prompt(payload.selected_text, payload.analysis)
    client = get_client()
    target_language = payload.target_language or "English"

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=f"""{prompt}

Additional tasks:
3. Rewrite the plain-English explanation in {target_language}.
   - Keep any quoted legal terms, field names, or labels exactly as written.
   - Preserve abbreviations, IDs, and any text inside brackets or parentheses.
4. Ensure keyTerms definitions are written in {target_language}.

Return JSON where:
- explanation: the {target_language} version
- keyTerms: definitions in {target_language}
- translatedText: "" (empty string)
- translatedLanguage: "{target_language}"
""",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema={
                "type": "object",
                "properties": {
                    "explanation": {"type": "string"},
                    "keyTerms": {"type": "array", "items": {"type": "string"}},
                    "translatedText": {"type": "string"},
                    "translatedLanguage": {"type": "string"},
                },
                "required": ["explanation", "keyTerms", "translatedText", "translatedLanguage"],
            },
        ),
    )

    result = parse_json_response(getattr(response, "text", None))
    result["translatedText"] = ""
    result["translatedLanguage"] = target_language
    return SimplifyResponse(**result)


@app.post("/api/tts")
def text_to_speech(payload: TtsRequest) -> Response:
    _, voice_id = get_elevenlabs_config()
    client = get_elevenlabs_client()
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")
    try:
        audio_stream = client.text_to_speech.convert(
            text=payload.text,
            voice_id=voice_id,
            model_id="eleven_multilingual_v2",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to reach ElevenLabs.") from exc

    if isinstance(audio_stream, (bytes, bytearray)):
        audio_bytes = bytes(audio_stream)
    else:
        try:
            audio_bytes = b"".join(chunk for chunk in audio_stream)
        except TypeError as exc:
            raise HTTPException(status_code=502, detail="Unexpected audio stream response.") from exc

    if not audio_bytes:
        raise HTTPException(status_code=502, detail="Empty audio response from ElevenLabs.")

    return Response(content=audio_bytes, media_type="audio/mpeg")
