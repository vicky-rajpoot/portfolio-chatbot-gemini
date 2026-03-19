# Portfolio Chatbot Gemini

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg)](https://fastapi.tiangolo.com/)

A lightweight, embeddable website chatbot powered by **Gemini Embedding 2** and **Gemini 2.0 Flash**. Perfect for adding a fast, RAG-enabled AI assistant to your portfolio, blog, or personal website.

Drop a `<script>` tag into any page to embed it. No npm, no build steps required.
---

## Project structure

```
gemini-chatbot/
├── main.py            ← FastAPI server (RAG logic lives here)
├── requirements.txt
├── .env.example       ← copy to .env and add your key
├── docs/              ← put your PDFs / .txt / .md files here
├── static/
│   └── widget.js      ← the embeddable chatbot widget
└── demo.html          ← example page showing how to embed
```

---

## 1. Setup

```bash
# Clone / copy the folder, then:
cd gemini-chatbot

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_actual_key
```

---

## 2. Add your documents

Drop any `.pdf`, `.txt`, or `.md` files into the `docs/` folder.
They are read and embedded **once at startup** — no re-indexing needed
unless you add new files (just restart the server).

---

## 3. Edit the system prompt

Open `main.py` and find `SYSTEM_PROMPT` near the top.
Replace the placeholder text with your actual business context:

```python
SYSTEM_PROMPT = """You are a helpful assistant for Acme Corp.
We sell cloud software for logistics teams.
Always be professional and helpful.
If you don't know the answer, say so."""
```

---

## 4. Run the server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

For production (with auto-restart):
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

Check it's working:
```
GET http://localhost:8000/health
→ {"status":"ok","chunks":42}
```

---

## 5. Embed on your website

Add these two things to any page where you want the chatbot:

```html
<!-- The container div — size with CSS however you want -->
<div id="my-chatbot"></div>

<!-- Config + widget loader (put just before </body>) -->
<script>
  window.ChatbotConfig = {
    containerId: "my-chatbot",
    apiBase:     "https://your-server.com",  // your server's public URL
    title:       "AI Assistant",
    subtitle:    "Ask me anything",
    placeholder: "Type a question...",
    chips:       ["What do you offer?", "How does pricing work?", "Contact us"],
  };
</script>
<script src="https://your-server.com/widget.js"></script>
```

That's it. No npm, no build step.

---

## Config options

| Option        | Default               | Description                          |
|---------------|-----------------------|--------------------------------------|
| `containerId` | `"chatbot"`           | ID of the div to mount into          |
| `apiBase`     | `""`                  | Your FastAPI server URL (required)   |
| `title`       | `"AI Assistant"`      | Header title                         |
| `subtitle`    | `"Ask me anything…"`  | Subtitle / description               |
| `placeholder` | `"Ask a question..."` | Input placeholder                    |
| `chips`       | `[…]`                 | Starter suggestion buttons           |

---

## Tuning

Edit constants in `main.py`:

| Constant       | Default | Effect                                    |
|----------------|---------|-------------------------------------------|
| `CHUNK_SIZE`   | 500     | Words per chunk (smaller = more precise)  |
| `CHUNK_OVERLAP`| 80      | Overlap between chunks                    |
| `TOP_K`        | 5       | How many chunks sent to Gemini per query  |
| `MAX_HISTORY`  | 10      | Conversation turns kept in context        |
| `TEMPERATURE`  | 0.3     | Lower = more factual, higher = creative   |

---

## Production tips

- Restrict CORS in `main.py` to your domain only:
  `allow_origins=["https://yoursite.com"]`
- Run behind nginx with a reverse proxy to `/api/` and `/widget.js`
- Use `systemd` or `pm2` (with pyenv) to keep it alive
- The server uses ~150–300 MB RAM depending on how many chunks you embed

---

## Contributing

Contributions are welcome! If you find a bug or have an idea for a feature, please open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
