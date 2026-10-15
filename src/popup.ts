import * as vscode from "vscode";
import { Avatar } from "./avatars";
import { Choice } from "./scheduler";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function nonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 24 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

/**
 * The avatar runs into view, asks the question with Yes / Skip / Remind me later,
 * reacts to the answer and runs off. Closing the panel counts as Skip.
 */
export function askWithAvatar(
  avatar: Avatar,
  name: string,
  question: string,
): Promise<Choice> {
  return new Promise<Choice>((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      "hebbyAsk",
      `${name} is here!!`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true },
    );

    let settled = false;
    const finish = (c: Choice) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(c);
    };

    const n = nonce();
    const directionClass =
      avatar.id.trim().toLowerCase() === "fox"
        ? "left-to-right"
        : "right-to-left";
    panel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}';">
<style>
  html,body{height:100%;margin:0;overflow:hidden;background:transparent;font-family:var(--vscode-font-family)}
  .stage{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:10vh}
  .bubble{margin-bottom:14px;padding:12px 18px;border-radius:16px;max-width:280px;text-align:center;font-size:15px;
          color:var(--vscode-editor-foreground);background:var(--vscode-editorWidget-background);
          border:1px solid var(--vscode-editorWidget-border);animation:pop .35s 1.2s both}
  .actions{display:flex;gap:8px;margin-top:12px;justify-content:center;flex-wrap:wrap}
  button{font:inherit;font-size:13px;padding:5px 12px;border-radius:4px;cursor:pointer;border:1px solid var(--vscode-button-border,transparent);
         color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground)}
  button.primary{color:var(--vscode-button-foreground);background:var(--vscode-button-background)}
  button:hover{filter:brightness(1.15)}
  
  .runner{animation:runin-ltr 1.2s cubic-bezier(.2,.7,.3,1) both}
  .char{width:170px;animation:hop .2s ease-in-out 6, idle 1.4s ease-in-out 1.2s infinite}

  .left-to-right .runner{animation-name:runin-ltr}
  .right-to-left .runner{animation-name:runin-rtl}

  .left-to-right.leave .runner{animation:runout-ltr .8s ease-in forwards}
  .right-to-left.leave .runner{animation:runout-rtl .8s ease-in forwards}

  .leave .char{animation:hop .2s ease-in-out infinite}
  .leave .bubble{animation:none;opacity:1}

  @keyframes runin-ltr{from{transform:translateX(-120vw)}to{transform:translateX(0)}}
  @keyframes runout-ltr{from{transform:translateX(0)}to{transform:translateX(120vw)}}
  @keyframes runin-rtl{from{transform:translateX(120vw)}to{transform:translateX(0)}}
  @keyframes runout-rtl{from{transform:translateX(0)}to{transform:translateX(-120vw)}}
  @keyframes hop{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-16px) rotate(3deg)}}
  @keyframes idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
  @keyframes pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
</style></head>
<body><div class="stage ${directionClass}" id="stage">
  <div class="bubble"><div id="msg">${esc(question)}</div>
    <div class="actions" id="actions">
      <button class="primary" data-c="yes">Yes</button>
      <button data-c="skip">Skip</button>
      <button data-c="later">Remind me later</button>
    </div>
  </div>
  <div class="runner"><div class="char">${avatar.svg}</div></div>
</div>
<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const replies = { yes: 'Awesome, ${esc(name)} is proud of you! 🎉', skip: 'No worries, maybe next time!', later: "Okay, I'll come back soon!" };
  document.getElementById('actions').addEventListener('click', e => {
    const c = e.target && e.target.dataset && e.target.dataset.c;
    if (!c) return;
    document.getElementById('msg').textContent = replies[c];
    document.getElementById('actions').remove();
    document.getElementById('stage').classList.add('leave');
    vscode.postMessage({ choice: c });
  });
</script></body></html>`;

    panel.webview.onDidReceiveMessage((msg: { choice?: string }) => {
      const c = msg?.choice;
      if (c === "yes" || c === "skip" || c === "later") {
        finish(c);
        setTimeout(() => panel.dispose(), 1500); // let the avatar run off first
      }
    });
    panel.onDidDispose(() => finish("skip"));
  });
}
