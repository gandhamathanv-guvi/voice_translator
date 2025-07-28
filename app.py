from fastapi import FastAPI, HTTPException, Depends, Request, Form
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from gtts import gTTS
from deep_translator import GoogleTranslator
import os
import uuid
import tempfile
import sqlite3
import hashlib
import jwt
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

app = FastAPI(
    title="Voice Translator Web App",
    description="Full-stack web application for text-to-speech conversion and translation with user authentication",
    version="2.0.0"
)

# Security
security = HTTPBearer(auto_error=False)

# Create directories for static files and audio
static_dir = Path("static")
static_dir.mkdir(exist_ok=True)
(static_dir / "audio").mkdir(exist_ok=True)
(static_dir / "css").mkdir(exist_ok=True)
(static_dir / "js").mkdir(exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Database setup
def init_db():
    """Initialize SQLite database for user authentication"""
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# Pydantic models
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class TTSRequest(BaseModel):
    text: str
    language: str = "en"

class TranslateAndSpeakRequest(BaseModel):
    text: str
    target_languages: List[str]
    source_language: str = "auto"

class TranslationResult(BaseModel):
    language: str
    translated_text: str
    audio_url: Optional[str] = None

class MultiLanguageTextRequest(BaseModel):
    texts: List[dict]

class GenerateAudioRequest(BaseModel):
    text: str
    language: str

# Utility functions
def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """Verify JWT token and return user data"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_user(username: str) -> Optional[Dict]:
    """Get user from database"""
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("SELECT username, password_hash FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return {"username": user[0], "password_hash": user[1]}
    return None

def create_user(username: str, password: str) -> bool:
    """Create new user in database"""
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    
    try:
        password_hash = hash_password(password)
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                      (username, password_hash))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False

def generate_audio_file(text: str, language: str) -> tuple[str, str]:
    """Generate audio file from text and return file path and URL"""
    try:
        tts = gTTS(text=text, lang=language)
        filename = f"voice_{uuid.uuid4().hex}.mp3"
        filepath = static_dir / "audio" / filename
        tts.save(str(filepath))
        audio_url = f"/static/audio/{filename}"
        return str(filepath), audio_url
    except Exception as e:
        logger.error(f"Error generating audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate audio: {str(e)}")

def translate_text(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate text from source language to target language"""
    try:
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        return translator.translate(text)
    except Exception as e:
        logger.error(f"Error translating text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to translate text: {str(e)}")

# Static file endpoints
@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the main login/signup page"""
    try:
        with open("static/index.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse("""
        <html>
            <body>
                <h1>Voice Translator Web App</h1>
                <p>Please run the setup to create the frontend files.</p>
                <p>Static files not found. Make sure to create the HTML, CSS, and JS files.</p>
            </body>
        </html>
        """)

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    """Serve the dashboard page"""
    try:
        with open("static/dashboard.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse("""
        <html>
            <body>
                <h1>Dashboard</h1>
                <p>Dashboard HTML file not found.</p>
            </body>
        </html>
        """)

@app.get("/translate", response_class=HTMLResponse)
async def translate_page():
    """Serve the translate page"""
    try:
        with open("static/translate.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse("""
        <html>
            <body>
                <h1>Translate</h1>
                <p>Translate HTML file not found.</p>
            </body>
        </html>
        """)

# Authentication endpoints
@app.post("/signup")
async def signup(user: UserCreate):
    """User registration endpoint"""
    if len(user.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long")
    
    if len(user.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    if create_user(user.username, user.password):
        return {"message": "User created successfully"}
    else:
        raise HTTPException(status_code=400, detail="Username already exists")

@app.post("/login")
async def login(user: UserLogin):
    """User login endpoint"""
    db_user = get_user(user.username)
    
    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# Voice translation endpoints (protected)
@app.post("/generate-audio")
async def generate_audio(request: GenerateAudioRequest, current_user: Dict = Depends(verify_token)):
    """Generate audio from text (protected endpoint)"""
    try:
        filepath, audio_url = generate_audio_file(request.text, request.language)
        return {
            "message": "Audio generated successfully",
            "audio_url": audio_url,
            "language": request.language,
            "text": request.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/text-to-speech")
async def text_to_speech(request: TTSRequest, current_user: Dict = Depends(verify_token)):
    """Convert text to speech and return audio URL"""
    try:
        filepath, audio_url = generate_audio_file(request.text, request.language)
        return {
            "audio_url": audio_url,
            "language": request.language,
            "text": request.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/translate-and-speak")
async def translate_and_speak(request: TranslateAndSpeakRequest, current_user: Dict = Depends(verify_token)):
    """Translate text to multiple languages and generate audio files"""
    results = []
    
    for target_lang in request.target_languages:
        try:
            # Translate text
            translated_text = translate_text(request.text, target_lang, request.source_language)
            
            # Generate audio file
            filepath, audio_url = generate_audio_file(translated_text, target_lang)
            
            results.append(TranslationResult(
                language=target_lang,
                translated_text=translated_text,
                audio_url=audio_url
            ))
            
        except Exception as e:
            logger.error(f"Error processing language {target_lang}: {str(e)}")
            results.append(TranslationResult(
                language=target_lang,
                translated_text="Translation failed",
                audio_url=None
            ))
    
    return {"results": results}

@app.post("/multi-language-speak")
async def multi_language_speak(request: MultiLanguageTextRequest, current_user: Dict = Depends(verify_token)):
    """Convert multiple texts in different languages to speech"""
    results = []
    
    for item in request.texts:
        try:
            text = item.get("text", "")
            language = item.get("language", "en")
            
            if not text:
                results.append({
                    "language": language,
                    "status": "error",
                    "message": "Text is required"
                })
                continue
            
            filepath, audio_url = generate_audio_file(text, language)
            results.append({
                "language": language,
                "text": text,
                "audio_url": audio_url,
                "status": "success"
            })
            
        except Exception as e:
            logger.error(f"Error processing text: {str(e)}")
            results.append({
                "language": item.get("language", "unknown"),
                "status": "error",
                "message": str(e)
            })
    
    return {"results": results}

@app.get("/supported-languages")
async def get_supported_languages():
    """Get list of commonly supported languages for TTS and translation"""
    return {
        "languages": {
            "en": "English",
            "ta": "Tamil",
            "hi": "Hindi",
            "te": "Telugu",
            "ar": "Arabic",
            "zh-cn": "Chinese (Simplified)",
            "zh-tw": "Chinese (Traditional)",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "it": "Italian",
            "ja": "Japanese",
            "ko": "Korean",
            "pt": "Portuguese",
            "ru": "Russian",
            "tr": "Turkish",
            "vi": "Vietnamese",
            "th": "Thai",
            "id": "Indonesian",
            "ms": "Malay",
            "fil": "Filipino"
        }
    }

# User info endpoint
@app.get("/me")
async def get_current_user(current_user: Dict = Depends(verify_token)):
    """Get current user information"""
    return {"username": current_user["username"]}

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "voice-translator-web-app"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
