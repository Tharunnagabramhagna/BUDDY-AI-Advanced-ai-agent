import speech_recognition as sr

r = sr.Recognizer()
m = sr.Microphone()

print("Available microphones:")
for i, name in enumerate(sr.Microphone.list_microphone_names()):
    print(f"  [{i}] {name}")

print("\nCalibrating...")
with m as source:
    r.adjust_for_ambient_noise(source, duration=1)
    print(f"Energy threshold set to: {r.energy_threshold}")
    print("Speak now (5 seconds)...")
    audio = r.listen(source, timeout=5, phrase_time_limit=5)

print("Recognizing...")
try:
    text = r.recognize_google(audio, language="en-US")
    print(f"You said: {text}")
except sr.UnknownValueError:
    print("Could not understand audio")
except sr.RequestError as e:
    print(f"API error: {e}")
