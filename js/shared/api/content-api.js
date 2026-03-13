import { STATIC_DATA_URLS } from "../config.js";

async function loadStaticJson(url, resourceLabel) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${resourceLabel}: ${response.status}`);
  }

  return response.json();
}

export function loadBlogCatalog() {
  return loadStaticJson(STATIC_DATA_URLS.blogs, "blogs");
}

export function loadProjectCatalog() {
  return loadStaticJson(STATIC_DATA_URLS.projects, "projects");
}

export function loadAviationCatalog() {
  return loadStaticJson(STATIC_DATA_URLS.aviation, "aviation content");
}

export async function fetchEmbeddedHtml(sourceUrl) {
  const response = await fetch(sourceUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load embedded content: ${response.status}`);
  }

  return response.text();
}

