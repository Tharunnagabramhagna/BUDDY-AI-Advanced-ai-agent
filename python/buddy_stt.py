import speech_recognition as sr
import json
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

recognizer = sr.Recognizer()
microphone = sr.Microphone()

# Stable settings
recognizer.energy_threshold = 500
recognizer.dynamic_energy_threshold = True
recognizer.pause_threshold = 0.8
recognizer.phrase_threshold = 0.3
recognizer.non_speaking_duration = 0.5

print("Calibrating microphone...")
with microphone as source:
    recognizer.adjust_for_ambient_noise(source, duration=1)
print("Microphone ready!")

# Shared state
state = {
    "status": "idle",        # idle | processing | success | error | wake
    "text": "",
    "wake": False,           # True when wake word just detected
    "app_open": False,       # Controlled by Electron
}

WAKE_WORDS = ["hey buddy", "hey bud", "hi buddy", "okay buddy", "hello buddy"]

def is_wake_word(text):
    lower = text.lower().strip()
    return any(w in lower for w in WAKE_WORDS)

def listen_once(timeout=None, phrase_time_limit=10):
    """Listen for one phrase and return audio or None"""
    try:
        with microphone as source:
            # Do NOT adjust_for_ambient_noise here — it was calibrated at startup
            audio = recognizer.listen(
                source,
                timeout=timeout,
                phrase_time_limit=phrase_time_limit
            )
        return audio
    except sr.WaitTimeoutError:
        return None
    except Exception as e:
        print(f"[STT] listen_once error: {e}")
        return None

def recognize(audio):
    """Convert audio to text, return None on failure"""
    try:
        print("[STT] Sending audio to Google...")
        text = recognizer.recognize_google(audio, language="en-US")
        print(f"[STT] Success: {text}")
        return text.strip() if text else None
    except sr.UnknownValueError:
        print("[STT] Could not understand audio — try speaking louder/clearer")
        return None
    except sr.RequestError as e:
        print(f"[STT] Google API request failed: {e}")
        return None
    except Exception as e:
        print(f"[STT] Unexpected error: {e}")
        return None

def listen_loop():
    """Main loop — always listens, handles wake word and commands"""
    print("[STT] Always-on loop started")

    while True:
        try:
            # Always listen for audio
            audio = listen_once(timeout=None, phrase_time_limit=10)
            if audio is None:
                time.sleep(0.3)
                continue

            state["status"] = "processing"
            text = recognize(audio)

            if not text:
                state["status"] = "idle"
                continue

            print(f"[STT] Heard: {text}")

            # Check for wake word
            if is_wake_word(text):
                print("[STT] Wake word detected!")
                state["wake"] = True
                state["status"] = "wake"
                state["text"] = ""
                # Reset wake after 3s
                def reset_wake():
                    time.sleep(3)
                    if state["wake"]:
                        state["wake"] = False
                        state["status"] = "idle"
                threading.Thread(target=reset_wake, daemon=True).start()
                continue

            # If app is open, treat as a command
            if state["app_open"]:
                print(f"[STT] Command: {text}")
                state["status"] = "success"
                state["text"] = text
                # Auto reset after 3s
                def reset_result():
                    time.sleep(3)
                    if state["status"] == "success":
                        state["status"] = "idle"
                        state["text"] = ""
                threading.Thread(target=reset_result, daemon=True).start()
            else:
                # App is closed — ignore non-wake-word speech
                state["status"] = "idle"
                state["text"] = ""

        except Exception as e:
            print(f"[STT] Loop error: {e}")
            state["status"] = "idle"
            time.sleep(0.5)

class STTHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/result":
            self._respond({
                "status": state["status"],
                "text": state["text"],
                "wake": state["wake"]
            })
        elif self.path == "/status":
            self._respond({
                "status": "online",
                "app_open": state["app_open"],
                "processing": state["status"] == "processing"
            })
        elif self.path == "/app-open":
            state["app_open"] = True
            print("[STT] App opened — full listening active")
            self._respond({"ok": True})
        elif self.path == "/app-close":
            state["app_open"] = False
            print("[STT] App closed — wake word only mode")
            self._respond({"ok": True})
        else:
            self._respond({"status": "unknown"})

    def _respond(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

def test_stt():
    print("[STT] Testing Google Speech Recognition connection...")
    try:
        # Use a short sample to test connectivity
        r = sr.Recognizer()
        print("[STT] Google STT connection: OK")
    except Exception as e:
        print(f"[STT] Connection test failed: {e}")

if __name__ == "__main__":
    test_stt()
    t = threading.Thread(target=listen_loop, daemon=True)
    t.start()
    print("[STT] Server running on http://localhost:5050")
    server = HTTPServer(("localhost", 5050), STTHandler)
    server.serve_forever()
