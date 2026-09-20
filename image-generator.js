/* Aikiyara Canvas: private, browser-side image generation workspace. */
const IMAGE_KEY = "aikiyara-gemini-key";
const modelEndpoint = (key) => `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(key)}`;

const styles = `
  .canvas-fab{position:fixed;right:24px;bottom:24px;z-index:20;border:0;border-radius:999px;padding:14px 18px;background:linear-gradient(135deg,#8b5cf6,#2dd4bf);color:#fff;font-weight:700;box-shadow:0 15px 35px #0005;cursor:pointer}
  .canvas-backdrop{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:#020617aa;backdrop-filter:blur(8px)}
  .canvas-modal{width:min(100%,720px);max-height:90vh;overflow:auto;padding:24px;border:1px solid #94a3b833;border-radius:24px;background:#111827;color:#e5eefb;box-shadow:0 24px 80px #0008;font-family:Inter,system-ui,sans-serif}
  .canvas-modal h2{margin:0 0 6px}.canvas-muted{margin:0 0 18px;color:#9aa7bb}.canvas-label{display:block;margin:12px 0 7px;color:#9aa7bb;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em}.canvas-input,.canvas-select{width:100%;padding:13px 14px;border:1px solid #94a3b833;border-radius:12px;background:#0f172acc;color:#e5eefb;font:inherit}.canvas-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.canvas-button{border:0;border-radius:12px;padding:11px 16px;background:linear-gradient(135deg,#8b5cf6,#2dd4bf);color:#fff;font-weight:700;cursor:pointer}.canvas-button.alt{border:1px solid #94a3b833;background:#ffffff0d}.canvas-status{min-height:22px;margin-top:12px;color:#9aa7bb}.canvas-preview{display:none;width:100%;margin-top:18px;border-radius:16px;border:1px solid #94a3b833}.canvas-close{float:right;border:0;background:transparent;color:#9aa7bb;font-size:1.5rem;cursor:pointer}
`;

document.head.append(Object.assign(document.createElement("style"), { textContent: styles }));

function createCanvas() {
  const fab = document.createElement("button");
  fab.className = "canvas-fab";
  fab.textContent = "✦ Create image";
  fab.type = "button";
  document.body.appendChild(fab);

  const backdrop = document.createElement("div");
  backdrop.className = "canvas-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="canvas-modal" role="dialog" aria-modal="true" aria-labelledby="canvasTitle">
      <button class="canvas-close" type="button" aria-label="Close">×</button>
      <h2 id="canvasTitle">Aikiyara Canvas</h2>
      <p class="canvas-muted">Apni idea ko visual banao — poster, thumbnail, concept art ya social post.</p>
      <label class="canvas-label" for="canvasPrompt">Describe your image</label>
      <textarea id="canvasPrompt" class="canvas-input" rows="4" placeholder="A warm cinematic study desk at sunrise, minimal purple and teal mood..."></textarea>
      <label class="canvas-label" for="canvasStyle">Visual direction</label>
      <select id="canvasStyle" class="canvas-select">
        <option value="cinematic editorial photography">Cinematic</option>
        <option value="clean modern 3D illustration">Modern 3D</option>
        <option value="bold minimal poster design">Minimal poster</option>
        <option value="detailed digital concept art">Concept art</option>
        <option value="soft watercolor illustration">Watercolor</option>
      </select>
      <div class="canvas-actions">
        <button id="canvasGenerate" class="canvas-button" type="button">Generate visual</button>
        <button id="canvasDownload" class="canvas-button alt" type="button" disabled>Download</button>
      </div>
      <p id="canvasStatus" class="canvas-status" role="status"></p>
      <img id="canvasPreview" class="canvas-preview" alt="Generated visual" />
    </section>`;
  document.body.appendChild(backdrop);

  const close = () => { backdrop.hidden = true; };
  fab.addEventListener("click", () => { backdrop.hidden = false; document.getElementById("canvasPrompt").focus(); });
  backdrop.querySelector(".canvas-close").addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });

  const generate = document.getElementById("canvasGenerate");
  const download = document.getElementById("canvasDownload");
  const status = document.getElementById("canvasStatus");
  const preview = document.getElementById("canvasPreview");
  let imageUrl = "";

  generate.addEventListener("click", async () => {
    const prompt = document.getElementById("canvasPrompt").value.trim();
    const style = document.getElementById("canvasStyle").value;
    const key = localStorage.getItem(IMAGE_KEY) || "";
    if (!key) { status.textContent = "Pehle AI Assistant me Gemini API key save karo."; return; }
    if (!prompt) { status.textContent = "Image ka idea likho."; return; }

    generate.disabled = true;
    download.disabled = true;
    status.textContent = "Aikiyara Canvas visual bana raha hai...";
    preview.style.display = "none";

    try {
      const response = await fetch(modelEndpoint(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: `${prompt}. Visual direction: ${style}. No readable text, no logos, polished composition.` }],
          parameters: { sampleCount: 1, aspectRatio: "1:1", personGeneration: "allow_adult" }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || "Image generation failed.");
      const encoded = data.predictions?.[0]?.bytesBase64Encoded;
      if (!encoded) throw new Error("Model ne image return nahi ki.");
      imageUrl = `data:image/png;base64,${encoded}`;
      preview.src = imageUrl;
      preview.style.display = "block";
      download.disabled = false;
      status.textContent = "Visual ready — download karke use karo.";
    } catch (error) {
      console.error(error);
      status.textContent = error.message || "Image generate nahi ho payi.";
    } finally {
      generate.disabled = false;
    }
  });

  download.addEventListener("click", () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `aikiyara-visual-${Date.now()}.png`;
    link.click();
  });
}

createCanvas();
