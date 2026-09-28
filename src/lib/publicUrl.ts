/** Address of a file that ships with the page. The base is "/" on the Mac, and a subpath on a shared site. */
export function publicUrl(path: string, base = import.meta.env.BASE_URL || "/"): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${path.replace(/^\/+/, "")}`;
}
