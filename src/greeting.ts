import * as vscode from "vscode";
import { Avatar } from "./avatars";

function greetingText(name: string): string {
  const h = new Date().getHours();
  const part =
    h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}! I'm ${name}. Let's code, and take care of ourselves 💪`;
}

/** Shows the avatar jumping in, saying hi, then fades out and closes itself. */
export function showGreeting(avatar: Avatar, name: string): void {
  const panel = vscode.window.createWebviewPanel(
    "hebbyGreeting",
    `${name} says hi`,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: false },
  );

  const safeName = name.replace(/[&<>"']/g, "");
  panel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
  html,body{height:100%;margin:0;overflow:hidden;background:transparent;font-family:var(--vscode-font-family)}
  .stage{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:12vh;
         animation:fade 5s ease-in-out forwards}
  .char{width:170px;animation:jump 1.1s cubic-bezier(.3,1.6,.5,1) both}
  .bubble{margin-bottom:12px;padding:10px 16px;border-radius:14px;max-width:260px;text-align:center;font-size:14px;
          color:var(--vscode-editor-foreground);background:var(--vscode-editorWidget-background);
          border:1px solid var(--vscode-editorWidget-border);animation:pop .4s .9s both}
  @keyframes jump{0%{transform:translateY(120vh) scale(.6)}60%{transform:translateY(-40px)}80%{transform:translateY(8px)}100%{transform:translateY(0)}}
  @keyframes pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
  @keyframes fade{0%,75%{opacity:1}100%{opacity:0}}
</style></head>
<body><div class="stage">
  <div class="bubble">${greetingText(safeName)}</div>
  <div class="char">${avatar.svg}</div>
</div></body></html>`;

  const t = setTimeout(() => panel.dispose(), 5200);
  panel.onDidDispose(() => clearTimeout(t));
}
