import home from "../netlify/functions/home.mjs";
import category from "../netlify/functions/category.mjs";
import product from "../netlify/functions/product.mjs";
import wholesale from "../netlify/functions/wholesale.mjs";
import sitemap from "../netlify/functions/sitemap.mjs";
import robots from "../netlify/functions/robots.mjs";
import llms from "../netlify/functions/llms.mjs";

export const onRequest = async (c) => {
  const p = new URL(c.request.url).pathname.replace(/\/+$/, "") || "/";
  let h = null;
  if (p === "/") h = home;
  else if (p === "/products" || p.startsWith("/c/")) h = category;
  else if (p.startsWith("/p/")) h = product;
  else if (p === "/wholesale") h = wholesale;
  else if (p === "/sitemap.xml") h = sitemap;
  else if (p === "/robots.txt") h = robots;
  else if (p === "/llms.txt") h = llms;
  if (!h) return c.next();
  return h(c.request, c);
};
