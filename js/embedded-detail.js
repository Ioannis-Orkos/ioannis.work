export function getFolderFromLocation({
  primaryPathPrefix,
  legacyPathPrefix = "",
  hashPrefix = "",
}) {
  const pathname = (window.location.pathname || "/").replace(/\/+$/, "") || "/";

  if (primaryPathPrefix && pathname.startsWith(primaryPathPrefix)) {
    const folder = pathname.slice(primaryPathPrefix.length).split("/")[0];
    if (folder) return folder;
  }

  if (legacyPathPrefix && pathname.startsWith(legacyPathPrefix)) {
    const folder = pathname.slice(legacyPathPrefix.length).split("/")[0];
    if (folder) return folder;
  }

  const hash = window.location.hash.replace("#", "");
  return hashPrefix && hash.startsWith(hashPrefix)
    ? hash.slice(hashPrefix.length)
    : "";
}

function isCrossOriginUrl(value) {
  try {
    const target = new URL(String(value || ""), window.location.href);
    return target.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractDocumentParts(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(html || ""), "text/html");
  const { head, body } = parsed;
  const title = head?.querySelector("title")?.textContent?.trim() || "";
  const headMarkup = head ? head.innerHTML : "";
  const bodyMarkup = body ? body.innerHTML : String(html || "");

  return {
    title,
    headMarkup,
    bodyMarkup,
  };
}

function buildSharedStylesheetLinks() {
  const sharedHeadLinks = [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" rel="stylesheet" />',
  ];
  const sharedStylesheets = [
    "/css/reset.css",
    "/css/styles.css",
  ];

  return [
    ...sharedHeadLinks,
    ...sharedStylesheets.map((href) => `<link rel="stylesheet" href="${escapeHtmlAttribute(href)}" />`),
  ].join("\n");
}

function buildFrameSrcDoc({ frameId, html, sourceUrl, messageType }) {
  const { title, headMarkup, bodyMarkup } = extractDocumentParts(html);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${sourceUrl}" />
  ${title ? `<title>${escapeHtmlAttribute(title)}</title>` : ""}
  ${buildSharedStylesheetLinks()}
  ${headMarkup}
  <style>html,body{margin:0;padding:0;background:transparent;}</style>
</head>
<body>${bodyMarkup}
<script>
(() => {
  const frameId = ${JSON.stringify(frameId)};
  let heightScheduled = false;
  const syncTheme = () => {
    try {
      const parentTheme = parent?.document?.documentElement?.getAttribute("data-theme") || "light";
      document.documentElement.setAttribute("data-theme", parentTheme);
    } catch {}
  };
  const sendHeight = () => {
    const bodyHeight = document.body ? document.body.scrollHeight : 0;
    const htmlHeight = document.documentElement ? document.documentElement.scrollHeight : 0;
    const height = Math.max(bodyHeight, htmlHeight, 1);
    parent.postMessage({ type: ${JSON.stringify(messageType)}, frameId, height }, "*");
  };
  const scheduleHeight = () => {
    if (heightScheduled) return;
    heightScheduled = true;
    requestAnimationFrame(() => {
      heightScheduled = false;
      sendHeight();
    });
  };
  syncTheme();
  try {
    const parentRoot = parent?.document?.documentElement;
    if (parentRoot) {
      new MutationObserver(() => {
        syncTheme();
        scheduleHeight();
      }).observe(parentRoot, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    }
  } catch {}
  window.addEventListener("load", sendHeight);
  window.addEventListener("resize", scheduleHeight);
  new MutationObserver(scheduleHeight).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  sendHeight();
})();
</script>
</body>
</html>`;
}

export function createEmbeddedDetailController({
  mainEl,
  sectionDataAttribute,
  sectionDatasetKey,
  frameIdPrefix,
  messageType,
  failureMessage,
  failureLogLabel,
  sectionClassName = "page project-embedded-page",
  frameClassName = "project-embedded-frame",
}) {
  const embeddedFrameById = new Map();
  const sectionSelector = `section.page[${sectionDataAttribute}]`;

  const createSandboxedFrame = () => {
    const iframe = document.createElement("iframe");
    iframe.className = frameClassName;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute(
      "sandbox",
      "allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"
    );

    const frameId = `${frameIdPrefix}-${Math.random().toString(36).slice(2)}`;
    iframe.dataset.frameId = frameId;
    embeddedFrameById.set(frameId, iframe);
    return iframe;
  };

  const removeDynamicSections = () => {
    document.querySelectorAll(sectionSelector).forEach((node) => node.remove());
  };

  const ensureSection = ({ sectionId, folder }) => {
    removeDynamicSections();

    const section = document.createElement("section");
    section.id = sectionId;
    section.className = sectionClassName;
    section.dataset[sectionDatasetKey] = folder;
    section.innerHTML = "";
    mainEl.appendChild(section);
    return section;
  };

  const renderHtmlIntoSection = (section, html, sourceUrl) => {
    const iframe = createSandboxedFrame();
    const frameId = String(iframe.dataset.frameId || "");
    iframe.srcdoc = buildFrameSrcDoc({
      frameId,
      html,
      sourceUrl,
      messageType,
    });

    section.innerHTML = "";
    section.appendChild(iframe);
  };

  const renderUrlIntoSection = async (section, sourceUrl) => {
    try {
      if (isCrossOriginUrl(sourceUrl)) {
        const iframe = createSandboxedFrame();
        iframe.src = sourceUrl;
        section.innerHTML = "";
        section.appendChild(iframe);
        return;
      }

      const response = await fetch(sourceUrl, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Failed to load embedded content: ${response.status}`);
      }

      const html = await response.text();
      renderHtmlIntoSection(section, html, sourceUrl);
    } catch (error) {
      console.error(failureLogLabel, error);
      section.innerHTML = `<p>${failureMessage}</p>`;
    }
  };

  window.addEventListener("message", (event) => {
    const data = event?.data;
    if (!data || data.type !== messageType) return;

    const frame = embeddedFrameById.get(String(data.frameId || ""));
    if (!frame) return;

    const nextHeight = Number(data.height);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;

    frame.style.height = `${Math.max(1, Math.round(nextHeight))}px`;
  });

  return {
    ensureSection,
    renderHtmlIntoSection,
    renderUrlIntoSection,
  };
}
