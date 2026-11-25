import home from "../netlify/functions/home.mjs";
import category from "../netlify/functions/category.mjs";
import product from "../netlify/functions/product.mjs";
import wholesale from "../netlify/functions/wholesale.mjs";
import sitemap from "../netlify/functions/sitemap.mjs";
import robots from "../netlify/functions/robots.mjs";
import llms from "../netlify/functions/llms.mjs";

export const onRequest = async (c) => {
  const p = new URL(c.request.url).pathname.replace(/\/+$/, "") || "/";
  if (p === "/google9e1317c29e841629.html") return new Response("google-site-verification: google9e1317c29e841629.html", { headers: { "content-type": "text/html; charset=utf-8" } });
  let h = null;
  if (p === "/") h = home;
  else if (p === "/products" || p.startsWith("/c/")) h = category;
  else if (p.startsWith("/p/")) h = product;
  else if (p === "/wholesale") h = wholesale;
  else if (p === "/sitemap.xml") h = sitemap;
  else if (p === "/robots.txt") h = robots;
  else if (p === "/llms.txt") h = llms;
  if (!h) return c.next();
  const r = await h(c.request, c);
  const n = new Response(r.body, r);
  n.headers.set("X-Content-Type-Options", "nosniff");
  n.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  n.headers.set("X-Frame-Options", "SAMEORIGIN");
  n.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  n.headers.set("Strict-Transport-Security", "max-age=31536000");
  return n;
};
