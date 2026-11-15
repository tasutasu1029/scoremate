// スコアメイト（iPad 版）: 合言葉で楽譜データを開く
// 楽譜データは暗号化して置いてあり、合言葉を知っている人だけが読めます。
(function () {
  "use strict";
  const SALT = "WaEaezjZ8bMykhzfWSxCiQ==";
  const ITERATIONS = 310000;
  const KEY_STORE = "scoremate:siteKey";

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

  async function keyFromPassphrase(pass) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: b64(SALT), iterations: ITERATIONS, hash: "SHA-256" }, base, 256);
    return new Uint8Array(bits);
  }

  async function decrypt(raw, blob) {
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const data = b64(blob);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, key, data.slice(12));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function savedKey() {
    try { const s = localStorage.getItem(KEY_STORE); return s ? b64(s) : null; } catch (e) { return null; }
  }
  function saveKey(raw) {
    try { localStorage.setItem(KEY_STORE, toB64(raw)); } catch (e) {}
  }

  const CSS = `
  .sm-lock { position: fixed; inset: 0; z-index: 1000; background: var(--bg); display: grid; place-items: center;
    padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left)); }
  .sm-lock form { width: min(360px, 100%); display: grid; gap: 14px; }
  .sm-lock h1 { margin: 0; font-size: 26px; font-weight: 900; color: var(--ink); }
  .sm-lock p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--ink2); font-weight: 600; }
  .sm-lock input { font: inherit; font-size: 18px; font-weight: 700; padding: 14px 16px; border-radius: 14px; border: 2px solid var(--line);
    background: var(--surface); color: var(--ink); letter-spacing: .04em; }
  .sm-lock input:focus { outline: none; border-color: var(--accent); }
  .sm-lock button { font: inherit; font-size: 17px; font-weight: 800; padding: 14px; border: 0; border-radius: 14px; background: var(--accent); color: var(--onAccent); }
  .sm-lock button:disabled { opacity: .6; }
  .sm-lock .err { color: var(--error); font-size: 13px; font-weight: 700; min-height: 1.2em; }`;

  function askPassphrase(tryKey) {
    return new Promise(resolve => {
      const style = document.createElement("style");
      style.textContent = CSS;
      document.head.appendChild(style);
      const box = document.createElement("div");
      box.className = "sm-lock";
      box.innerHTML = `<form autocomplete="off">
        <h1>スコアメイト</h1>
        <p>合言葉を入力してください。<br>一度入力すると、この端末では次から入力不要です。</p>
        <input type="text" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="合言葉" aria-label="合言葉">
        <button type="submit">開く</button>
        <div class="err" role="alert"></div></form>`;
      document.body.appendChild(box);
      const form = box.querySelector("form"), input = box.querySelector("input"), btn = box.querySelector("button"), err = box.querySelector(".err");
      form.addEventListener("submit", async ev => {
        ev.preventDefault();
        const pass = input.value.trim();
        if (!pass) return;
        btn.disabled = true; btn.textContent = "確認中…"; err.textContent = "";
        try {
          const raw = await keyFromPassphrase(pass);
          const data = await tryKey(raw);
          saveKey(raw);
          box.remove();
          resolve(data);
        } catch (e) {
          err.textContent = "合言葉が違います";
          btn.disabled = false; btn.textContent = "開く";
        }
      });
      setTimeout(() => input.focus(), 50);
    });
  }

  /** 暗号化されたデータを開く。保存済みの鍵で開けなければ合言葉を聞く */
  async function open(blob) {
    const tryKey = raw => decrypt(raw, blob);
    const raw = savedKey();
    if (raw) {
      try { return await tryKey(raw); } catch (e) { /* 合言葉が変わった */ }
    }
    return askPassphrase(tryKey);
  }

  /** この端末に保存した合言葉を消す */
  function forget() { try { localStorage.removeItem(KEY_STORE); } catch (e) {} }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  window.SiteLib = { open, forget };
})();
