/**
 * Gemini RAG Chatbot Widget
 * -------------------------
 * Drop this into any page:
 *
 *   <div id="my-chatbot"></div>
 *   <script>
 *     window.ChatbotConfig = {
 *       containerId: "my-chatbot",   // the div to mount into
 *       apiBase: "https://your-server.com",  // your FastAPI server URL
 *       title: "Support Chat",       // optional
 *       subtitle: "Ask me anything", // optional
 *       placeholder: "Type a message...", // optional
 *     };
 *   </script>
 *   <script src="https://your-server.com/widget.js"></script>
 */

(function () {
  "use strict";

  const cfg = window.ChatbotConfig || {};
  const CONTAINER_ID = cfg.containerId || "chatbot";
  const API_BASE     = (cfg.apiBase || "").replace(/\/$/, "");
  const TITLE        = cfg.title || "AI Assistant";
  const SUBTITLE     = cfg.subtitle || "Ask me anything about our content";
  const PLACEHOLDER  = cfg.placeholder || "Ask a question...";
  const API_ENDPOINT = API_BASE + "/api/chat";

  /* ── Inject styles ─────────────────────────────────────────── */
  const STYLES = `
  .gcb-root *, .gcb-root *::before, .gcb-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .gcb-root {
    --bg:        #0f0f0f;
    --surface:   #1a1a1a;
    --surface2:  #242424;
    --surface3:  #2e2e2e;
    --border:    rgba(255,255,255,0.08);
    --border2:   rgba(255,255,255,0.14);
    --text:      #e8e8e8;
    --text-muted:#888;
    --text-dim:  #555;
    --accent:    #10a37f;
    --accent-h:  #0d8f6f;
    --accent-dim:rgba(16,163,127,0.12);
    --user-bg:   #1e3a34;
    --user-text: #d1f5ec;
    --radius:    14px;
    --font: ui-sans-serif, -apple-system, "Segoe UI", sans-serif;
    --mono: ui-monospace, "Fira Code", monospace;
    font-family: var(--font);
    background: var(--bg);
    border-radius: var(--radius);
    border: 1px solid var(--border2);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 620px;
    max-height: 80vh;
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
  }

  /* Header */
  .gcb-header {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .gcb-header-icon {
    width: 34px; height: 34px; border-radius: 10px;
    background: var(--accent); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .gcb-header-icon svg { width: 18px; height: 18px; }
  .gcb-header-text { flex: 1; }
  .gcb-title   { font-size: 14px; font-weight: 600; color: var(--text); }
  .gcb-subtitle{ font-size: 11px; color: var(--text-muted); margin-top: 1px; }
  .gcb-status  {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--accent); flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(16,163,127,0.2);
  }

  /* Messages */
  .gcb-messages {
    flex: 1; overflow-y: auto; padding: 20px 16px;
    display: flex; flex-direction: column; gap: 18px;
    scroll-behavior: smooth;
  }
  .gcb-messages::-webkit-scrollbar { width: 4px; }
  .gcb-messages::-webkit-scrollbar-track { background: transparent; }
  .gcb-messages::-webkit-scrollbar-thumb { background: #2e2e2e; border-radius: 2px; }

  /* Empty state */
  .gcb-empty {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; padding: 20px; gap: 10px;
    color: var(--text-muted);
  }
  .gcb-empty-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: var(--surface2); display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px;
  }
  .gcb-empty-icon svg { width: 20px; height: 20px; opacity: 0.5; }
  .gcb-empty-title { font-size: 15px; font-weight: 600; color: var(--text); }
  .gcb-empty-sub   { font-size: 12px; max-width: 220px; line-height: 1.6; }
  .gcb-chips       { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 6px; }
  .gcb-chip {
    font-size: 11px; padding: 5px 12px; border-radius: 20px;
    border: 1px solid var(--border2); color: var(--text-muted);
    cursor: pointer; transition: all 0.15s; background: var(--surface2);
  }
  .gcb-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }

  /* Message rows */
  .gcb-msg       { display: flex; gap: 10px; align-items: flex-start; animation: gcb-fadein 0.2s ease; }
  .gcb-msg.user  { flex-direction: row-reverse; }
  @keyframes gcb-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  .gcb-avatar {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; margin-top: 2px;
  }
  .gcb-msg.user      .gcb-avatar { background: #3d4f8a; color: #aab4f0; }
  .gcb-msg.assistant .gcb-avatar { background: var(--accent); }
  .gcb-msg.assistant .gcb-avatar svg { width: 14px; height: 14px; }

  .gcb-bubble {
    max-width: 82%; padding: 10px 14px; border-radius: 14px; font-size: 13.5px;
    line-height: 1.65;
  }
  .gcb-msg.user      .gcb-bubble { background: var(--user-bg); color: var(--user-text); border-radius: 14px 4px 14px 14px; }
  .gcb-msg.assistant .gcb-bubble { background: var(--surface2); color: var(--text); border-radius: 4px 14px 14px 14px; border: 1px solid var(--border); }

  /* Markdown inside bubbles */
  .gcb-bubble p              { margin-bottom: 8px; }
  .gcb-bubble p:last-child   { margin-bottom: 0; }
  .gcb-bubble strong         { font-weight: 600; color: var(--text); }
  .gcb-bubble em             { font-style: italic; color: var(--text-muted); }
  .gcb-bubble code           { background: var(--surface3); border-radius: 4px; padding: 1px 5px; font-family: var(--mono); font-size: 12px; color: #e9c46a; }
  .gcb-bubble pre            { background: var(--surface3); border-radius: 8px; padding: 12px; overflow-x: auto; margin: 8px 0; }
  .gcb-bubble pre code       { background: none; padding: 0; }
  .gcb-bubble ul, .gcb-bubble ol { padding-left: 18px; margin-bottom: 8px; }
  .gcb-bubble li             { margin-bottom: 3px; }
  .gcb-bubble h1,.gcb-bubble h2,.gcb-bubble h3 { font-weight: 600; margin: 10px 0 4px; }
  .gcb-bubble blockquote     { border-left: 3px solid var(--accent); padding-left: 10px; color: var(--text-muted); margin: 6px 0; }
  .gcb-bubble a              { color: var(--accent); text-decoration: none; }
  .gcb-bubble a:hover        { text-decoration: underline; }

  /* Sources */
  .gcb-sources {
    margin-top: 8px; display: flex; align-items: center; gap: 6px;
    font-size: 10px; color: var(--text-dim);
  }
  .gcb-sources-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
  .gcb-src-tag {
    background: var(--surface3); border: 1px solid var(--border); border-radius: 4px;
    padding: 1px 6px; font-size: 10px; color: var(--text-dim);
  }

  /* Typing indicator */
  .gcb-typing .gcb-bubble { background: var(--surface2); border: 1px solid var(--border); padding: 12px 16px; }
  .gcb-dots { display: flex; gap: 4px; align-items: center; }
  .gcb-dots span {
    width: 5px; height: 5px; border-radius: 50%; background: var(--text-dim);
    animation: gcb-bounce 1.1s infinite;
  }
  .gcb-dots span:nth-child(2) { animation-delay: 0.2s; }
  .gcb-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes gcb-bounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-5px);opacity:1} }

  /* Input area */
  .gcb-input-area {
    padding: 12px 14px 14px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  .gcb-input-row {
    display: flex; align-items: flex-end; gap: 8px;
    background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 12px; padding: 8px 10px;
    transition: border-color 0.2s;
  }
  .gcb-input-row:focus-within { border-color: rgba(16,163,127,0.4); }
  .gcb-textarea {
    flex: 1; background: none; border: none; outline: none;
    color: var(--text); font-size: 13.5px; font-family: var(--font);
    resize: none; line-height: 1.5; max-height: 140px; overflow-y: auto;
    min-height: 22px;
  }
  .gcb-textarea::placeholder { color: var(--text-dim); }
  .gcb-send {
    width: 30px; height: 30px; border-radius: 8px; border: none;
    background: var(--accent); color: white; cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, transform 0.1s; align-self: flex-end;
  }
  .gcb-send:hover:not(:disabled)  { background: var(--accent-h); }
  .gcb-send:active:not(:disabled) { transform: scale(0.93); }
  .gcb-send:disabled               { background: var(--surface3); cursor: not-allowed; }
  .gcb-send svg { width: 14px; height: 14px; fill: white; }
  .gcb-hint { font-size: 10px; color: var(--text-dim); text-align: center; margin-top: 8px; }

  /* Error toast */
  .gcb-error-bubble {
    background: rgba(220,50,50,0.12); border: 1px solid rgba(220,50,50,0.25);
    color: #f87171; border-radius: 10px; padding: 9px 13px;
    font-size: 12.5px; text-align: center;
  }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  /* ── Simple markdown renderer (no external libs) ───────────── */
  function renderMarkdown(text) {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trim()}</code></pre>`)
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/^#{3}\s(.+)$/gm, "<h3>$1</h3>")
      .replace(/^#{2}\s(.+)$/gm, "<h2>$1</h2>")
      .replace(/^#{1}\s(.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^[-*]\s(.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      .replace(/^>\s(.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/^(?!<[hupb]|<li|<pre|<blockquote)(.+)$/gm, "$1")
      .replace(/(<\/h[123]>|<\/pre>|<\/ul>|<\/blockquote>)/g, "$1")
      .trim()
      .replace(/^(.+)$/, "<p>$1</p>");
  }

  /* ── Build DOM ──────────────────────────────────────────────── */
  function buildWidget(container) {
    container.innerHTML = "";
    container.classList.add("gcb-root");

    // Header
    const header = document.createElement("div");
    header.className = "gcb-header";
    header.innerHTML = `
      <div class="gcb-header-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div class="gcb-header-text">
        <div class="gcb-title">${TITLE}</div>
        <div class="gcb-subtitle">${SUBTITLE}</div>
      </div>
      <div class="gcb-status"></div>`;
    container.appendChild(header);

    // Messages area
    const msgArea = document.createElement("div");
    msgArea.className = "gcb-messages";
    msgArea.id = "gcb-messages";

    // Empty state
    const empty = document.createElement("div");
    empty.className = "gcb-empty";
    empty.id = "gcb-empty";
    empty.innerHTML = `
      <div class="gcb-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="gcb-empty-title">How can I help?</div>
      <div class="gcb-empty-sub">${SUBTITLE}</div>
      <div class="gcb-chips" id="gcb-chips"></div>`;
    msgArea.appendChild(empty);
    container.appendChild(msgArea);

    // Starter chips — customise these in your config or hardcode here
    const chips = cfg.chips || ["What do you offer?", "How does this work?", "Tell me more"];
    const chipsEl = empty.querySelector("#gcb-chips");
    chips.forEach(text => {
      const chip = document.createElement("div");
      chip.className = "gcb-chip";
      chip.textContent = text;
      chip.addEventListener("click", () => submitMessage(text));
      chipsEl.appendChild(chip);
    });

    // Input area
    const inputArea = document.createElement("div");
    inputArea.className = "gcb-input-area";
    inputArea.innerHTML = `
      <div class="gcb-input-row">
        <textarea class="gcb-textarea" id="gcb-textarea" rows="1" placeholder="${PLACEHOLDER}"></textarea>
        <button class="gcb-send" id="gcb-send" title="Send">
          <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
      <div class="gcb-hint">Powered by Gemini · Your data stays private</div>`;
    container.appendChild(inputArea);

    // Events
    const textarea = inputArea.querySelector("#gcb-textarea");
    const sendBtn  = inputArea.querySelector("#gcb-send");

    sendBtn.addEventListener("click", () => submitMessage());
    textarea.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitMessage(); }
    });
    textarea.addEventListener("input", () => autoResize(textarea));
  }

  /* ── State ──────────────────────────────────────────────────── */
  let history  = [];   // [{role, content}]
  let isBusy   = false;

  /* ── Message helpers ────────────────────────────────────────── */
  function getEl(id) { return document.getElementById(id); }

  function showMessages() {
    const empty = getEl("gcb-empty");
    if (empty) empty.remove();
  }

  function appendMsg(role, html, sources = []) {
    showMessages();
    const area = getEl("gcb-messages");
    const row  = document.createElement("div");
    row.className = `gcb-msg ${role}`;

    const avatarHtml = role === "user"
      ? `<div class="gcb-avatar">U</div>`
      : `<div class="gcb-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" width="14" height="14"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>`;

    const srcHtml = (role === "assistant" && sources.length > 0)
      ? `<div class="gcb-sources">
           <div class="gcb-sources-dot"></div>
           Sources: ${sources.map(s => `<span class="gcb-src-tag">${s}</span>`).join(" ")}
         </div>`
      : "";

    row.innerHTML = `${avatarHtml}<div class="gcb-bubble">${html}${srcHtml}</div>`;
    area.appendChild(row);
    area.scrollTop = area.scrollHeight;
    return row;
  }

  function appendTyping() {
    showMessages();
    const area = getEl("gcb-messages");
    const row  = document.createElement("div");
    row.className = "gcb-msg assistant gcb-typing";
    row.id = "gcb-typing";
    row.innerHTML = `
      <div class="gcb-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" width="14" height="14">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div class="gcb-bubble"><div class="gcb-dots"><span></span><span></span><span></span></div></div>`;
    area.appendChild(row);
    area.scrollTop = area.scrollHeight;
    return row;
  }

  function removeTyping() {
    const t = getEl("gcb-typing");
    if (t) t.remove();
  }

  function setDisabled(disabled) {
    const btn = getEl("gcb-send");
    const ta  = getEl("gcb-textarea");
    if (btn) btn.disabled = disabled;
    if (ta)  ta.disabled  = disabled;
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  /* ── Submit ─────────────────────────────────────────────────── */
  async function submitMessage(text) {
    if (isBusy) return;
    const textarea = getEl("gcb-textarea");
    const message  = (text || textarea.value).trim();
    if (!message) return;

    textarea.value = "";
    autoResize(textarea);
    isBusy = true;
    setDisabled(true);

    appendMsg("user", message.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"));

    const typing = appendTyping();

    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      removeTyping();

      appendMsg("assistant", renderMarkdown(data.reply), data.sources || []);

      history.push({ role: "user",  content: message });
      history.push({ role: "model", content: data.reply });
      if (history.length > 20) history = history.slice(-20);

    } catch (err) {
      removeTyping();
      const area = getEl("gcb-messages");
      const errEl = document.createElement("div");
      errEl.className = "gcb-error-bubble";
      errEl.textContent = "Sorry, something went wrong: " + err.message;
      area.appendChild(errEl);
      area.scrollTop = area.scrollHeight;
    }

    isBusy = false;
    setDisabled(false);
    textarea.focus();
  }

  /* ── Mount ──────────────────────────────────────────────────── */
  function mount() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
      console.warn(`[Chatbot] Container #${CONTAINER_ID} not found.`);
      return;
    }
    buildWidget(container);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
