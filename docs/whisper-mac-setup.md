# Whisper STT server — Mac setup guide

The speaking module (`/speaking`) streams recorded audio to a Whisper server running on the Mac.
The Next.js app proxies every request through `POST /api/stt/transcribe`, so the Mac endpoint
is never exposed to the browser and stays server-side.

This guide covers the **whisper.cpp** server, which is the default target. An alternative using
**faster-whisper** is described at the end.

> **Can I use LM Studio instead of whisper.cpp?**
> No — not yet (as of mid-2026). LM Studio's OpenAI-compatible API exposes exactly five endpoints
> (`/v1/models`, `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/responses`).
> There is no `/v1/audio/transcriptions` or equivalent. You _can_ download Whisper models through
> LM Studio's UI, but they cannot be loaded for inference
> ([bug-tracker#1715](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1715),
> [lms#320](https://github.com/lmstudio-ai/lms/issues/320)).
> The `lmstudio.ai/transcribe` page shows "coming soon" with no API preview or timeline.
> **whisper.cpp must be run as a separate process.** When LM Studio ships STT support, the
> only required change will be in `lib/transcriber/whisper-transcriber.ts` (one HTTP call) —
> the rest of the app is insulated by the `Transcriber` seam.

---

## How the app talks to Whisper

```
Browser → POST /api/stt/transcribe (same-origin)
              ↓
       Next.js route handler
              ↓
       POST {MAC_STT_URL}/inference   ← whisper.cpp server on the Mac
              multipart form: file=audio.wav, response_format=json
              response:       { "text": "…" }
```

The app sends a **16 kHz mono WAV** file (normalized in the browser before upload) and
expects the JSON response `{ "text": "…" }`.

---

## 1. Build whisper.cpp

### Prerequisites

- Xcode Command Line Tools: `xcode-select --install`
- CMake ≥ 3.14: `brew install cmake` (or check `cmake --version`)
- (Apple Silicon) Metal is detected and enabled automatically by CMake.
- (Intel) The build falls back to CPU. Expect slower inference.

### Clone and build

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
cmake -B build
cmake --build build -j --config Release
```

The server binary lands at **`./build/bin/whisper-server`**.

---

## 2. Download a model

whisper.cpp ships a download helper. Models live in `models/`:

```bash
# Fast, English-only — good starting point (~150 MB)
bash ./models/download-ggml-model.sh small.en

# Higher accuracy, still reasonably fast (~500 MB)
bash ./models/download-ggml-model.sh medium.en

# Multilingual small model (~150 MB) — use if you need non-English
bash ./models/download-ggml-model.sh small
```

> **Which model to pick?**
> `small.en` handles everyday speech well and runs in near-real-time on M-series Macs.
> Switch to `medium.en` if you want better accuracy on accented or quiet speech.

---

## 3. Start the server

From inside the `whisper.cpp` directory:

```bash
./build/bin/whisper-server \
  --model  models/ggml-small.en.bin \
  --host   0.0.0.0 \
  --port   8080
```

Flags:

| Flag                | Default     | Notes                                               |
| ------------------- | ----------- | --------------------------------------------------- |
| `--model` / `-m`    | —           | Path to the `.bin` model file (required)            |
| `--host`            | `127.0.0.1` | Use `0.0.0.0` to accept LAN / Tailscale connections |
| `--port` / `-p`     | `8080`      | Port the HTTP server listens on                     |
| `--threads` / `-t`  | 4           | Increase for faster CPU inference                   |
| `--language` / `-l` | `en`        | Force language; omit for auto-detect                |

### Verify it's running

```bash
curl http://localhost:8080/inference \
  -F file=@/path/to/any/audio.wav \
  -F response_format=json
# Expected: {"text":" Hello world."}
```

---

## 4. Configure the app

Add (or uncomment) `MAC_STT_URL` in `.env.local` at the project root:

```bash
# Same machine — Next.js and whisper.cpp both on your Mac
MAC_STT_URL=http://localhost:8080

# whisper.cpp on the Mac, Next.js on another laptop (LAN)
MAC_STT_URL=http://192.168.1.3:8080

# Remote access via Tailscale
MAC_STT_URL=http://mac-hostname.tailnet-name.ts.net:8080
```

Restart the dev server (`pnpm dev`) after changing `.env.local` — Next.js reads env vars at
startup.

---

## 5. Keep the server running across reboots (optional)

### launchd plist

Create `~/Library/LaunchAgents/com.whisper.server.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>             <string>com.whisper.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/whisper.cpp/build/bin/whisper-server</string>
    <string>--model</string>  <string>/path/to/whisper.cpp/models/ggml-small.en.bin</string>
    <string>--host</string>   <string>0.0.0.0</string>
    <string>--port</string>   <string>8080</string>
  </array>
  <key>RunAtLoad</key>         <true/>
  <key>KeepAlive</key>         <true/>
  <key>StandardOutPath</key>   <string>/tmp/whisper-server.log</string>
  <key>StandardErrorPath</key> <string>/tmp/whisper-server.err</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.whisper.server.plist
# To stop:  launchctl unload ~/Library/LaunchAgents/com.whisper.server.plist
# To check: launchctl list | grep whisper
```

---

## 6. Troubleshooting

### "Mac STT server not reachable" in the app

1. Confirm the server is running: `curl http://localhost:8080/inference -F "file=@test.wav" -F response_format=json`
2. Check `MAC_STT_URL` in `.env.local` — no trailing slash.
3. Restart `pnpm dev` after editing `.env.local`.
4. If Next.js runs on a different machine, ensure port 8080 is not firewalled:
   `nc -zv <mac-ip> 8080`

### Poor transcription quality

- Use a larger model: replace `small.en` with `medium.en`.
- Make sure the audio is not clipped — the normalize worker targets 16 kHz mono at ±1.0 float range.
- Pass `--language en` to skip language detection overhead.

### `whisper-server: command not found` / binary not found

- Run the CMake build first: `cmake -B build && cmake --build build -j --config Release`
- The binary is at `./build/bin/whisper-server` — **not** `./server`.

### Server crashes immediately

- Wrong model path — double-check the `--model` flag points to an existing `.bin` file.
- Insufficient RAM — `medium.en` needs ~2 GB free. Check with `vm_stat`.

### "Whisper server returned 400"

The server rejected the request. Most common cause: sending a format whisper.cpp cannot decode
(e.g., raw PCM without a WAV header). The app always sends a properly-encoded WAV, so this
usually means the server version is very old. Update whisper.cpp (`git pull && make`).

---

## Alternative: faster-whisper

[faster-whisper](https://github.com/SYSTRAN/faster-whisper) is a CTranslate2-based reimplementation
that is faster on CPU. However, it does **not** expose a `POST /inference` endpoint out of the box.

To use it you have two options:

**Option A — Use the OpenAI-compatible wrapper**
[`faster-whisper-server`](https://github.com/fedirz/faster-whisper-server) adds a
`POST /v1/audio/transcriptions` endpoint. To wire it up, change
`lib/transcriber/whisper-transcriber.ts` to:

```ts
form.append("model", "Systran/faster-whisper-small");
// POST to ${this.baseUrl}/v1/audio/transcriptions instead of /inference
```

**Option B — Write a thin shim**
Implement the `Transcriber` interface with a different HTTP call, then swap it in
`lib/transcriber/server.ts`. No other code changes are needed — that is the whole point of the
seam.
