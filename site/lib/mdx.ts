import { BASE_PATH } from "@/lib/config";

// Rewrite relative `.md` links in raw markdown to our /docs/<slug> routes so
// the existing docs render without 404s. Handles `[text](../foo/bar.md#hash)`,
// `[text](./quickstart.md)`, `[text](philosophy.md)` — anything that's
// relative and points at a .md file. Absolute URLs, anchors, and mailto are
// left alone.
//
// `currentSlug` is the slug array of the doc being rendered, e.g.
// `["concepts", "the-two-ledgers"]`.
export function rewriteDocLinks(source: string, currentSlug: string[]): string {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  return source.replace(linkRegex, (full, text: string, url: string) => {
    if (
      /^(https?:|mailto:|tel:|#|\/)/.test(url)
    ) {
      return full;
    }

    // Split off optional hash
    const hashIdx = url.indexOf("#");
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
    const pathPart = hashIdx >= 0 ? url.slice(0, hashIdx) : url;

    if (!pathPart.endsWith(".md")) return full;

    const dir = currentSlug.slice(0, -1);
    const parts = pathPart.replace(/\.md$/, "").split("/");
    const resolved: string[] = [...dir];
    for (const part of parts) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        resolved.pop();
        continue;
      }
      resolved.push(part);
    }

    // Strip trailing "README" — /docs/README is just /docs
    if (resolved[resolved.length - 1] === "README") resolved.pop();

    const target =
      BASE_PATH +
      "/docs" +
      (resolved.length ? "/" + resolved.join("/") : "") +
      hash;
    return `[${text}](${target})`;
  });
}
