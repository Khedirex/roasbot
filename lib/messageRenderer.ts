// lib/messageRenderer.ts
type Vars = Record<string, string | number | undefined>;

function bbcodeUrlToHtml(s: string) {
  // [url=https://...]Texto[/url] -> <a href="...">Texto</a>
  return s.replace(/\[url=(.+?)\](.+?)\[\/url\]/gi, (_m, href, text) => {
    const safeHref = String(href).replace(/"/g, "&quot;");
    return `<a href="${safeHref}">${text}</a>`;
  });
}

export function renderTemplate(
  template: string | undefined,
  vars: Vars
): { text: string; parseMode: "HTML" } {
  if (!template) return { text: "", parseMode: "HTML" };

  // 1) Substitui [PLACEHOLDER]
  let out = template.replace(/\[([A-Z0-9_]+)\]/gi, (_m, key) => {
    const k = String(key).toUpperCase();
    const v = vars[k];
    return v === undefined || v === null ? `[${k}]` : String(v);
  });

  // 2) BBCode para HTML (links clicáveis no Telegram)
  out = bbcodeUrlToHtml(out);

  // 3) Limite de segurança
  if (out.length > 3900) out = out.slice(0, 3900) + "…";

  return { text: out, parseMode: "HTML" };
}
