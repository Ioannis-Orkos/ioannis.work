import { escapeHtmlAttribute } from "../html.js";

// These rules control how the wrapper builds iframe content.
const DEFAULT_EMBED_RULES = Object.freeze({
  includeBaseHref: true,
  injectSharedStylesheets: true,
  injectInlineBaseStyle: true,
  syncParentTheme: true,
  syncHeightToParent: true,
  useDirectIframeForCrossOrigin: true,
});

const DEFAULT_FRAME_OPTIONS = Object.freeze({
  loading: "lazy",
  referrerPolicy: "no-referrer-when-downgrade",
  scrolling: "no",
  sandbox:
    "allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts",
});

// Named presets keep controller setup readable.
export const EMBED_RULE_PRESETS = Object.freeze({
  default: Object.freeze({
    ...DEFAULT_EMBED_RULES,
  }),
  databaseContent: Object.freeze({
    ...DEFAULT_EMBED_RULES,
  }),
  rawHtml: Object.freeze({
    ...DEFAULT_EMBED_RULES,
    injectSharedStylesheets: false,
    injectInlineBaseStyle: false,
  }),
});

function getCurrentThemeColor() {
  try {
    return String(document.documentElement?.getAttribute("data-theme-color") || "forest").toLowerCase();
  } catch {
    return "forest";
  }
}

function isCrossOriginUrl(value) {
  try {
    const target = new URL(String(value || ""), window.location.href);
    return target.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function normalizeEmbedRules(rules) {
  if (typeof rules === "string" && EMBED_RULE_PRESETS[rules]) {
    return {
      ...EMBED_RULE_PRESETS[rules],
    };
  }

  return {
    ...DEFAULT_EMBED_RULES,
    ...(rules && typeof rules === "object" ? rules : {}),
  };
}

function normalizeFrameOptions(frameOptions) {
  return {
    ...DEFAULT_FRAME_OPTIONS,
    ...(frameOptions && typeof frameOptions === "object" ? frameOptions : {}),
  };
}

function extractDocumentParts(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(html || ""), "text/html");
  const { head, body } = parsed;

  return {
    title: head?.querySelector("title")?.textContent?.trim() || "",
    headMarkup: head ? head.innerHTML : "",
    bodyMarkup: body ? body.innerHTML : String(html || ""),
  };
}

// Parent shared CSS that we optionally inject into srcdoc content.
function buildSharedStylesheetLinks({ frontendOrigin, themeColor }) {
  const sharedHeadLinks = [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" rel="stylesheet" />',
  ];
  const sharedStylesheets = [
    `/css/tokens.${escapeHtmlAttribute(themeColor)}.css`,
    "/css/reset.css",
    "/css/public/index.css",
  ];

  return [
    ...sharedHeadLinks,
    ...sharedStylesheets.map((href, index) => {
      const escapedHref = `${frontendOrigin}${escapeHtmlAttribute(href)}`;
      return index === 0
        ? `<link id="theme-palette-stylesheet" rel="stylesheet" href="${escapedHref}" />`
        : `<link rel="stylesheet" href="${escapedHref}" />`;
    }),
  ].join("\n");
}

// Script that runs inside the iframe. It can keep theme and height in sync with the parent.
function buildFrameBehaviorScript({ frameId, messageType, rules, frontendOrigin }) {
  if (!rules.syncParentTheme && !rules.syncHeightToParent) {
    return "";
  }

  return `<script>
(() => {
  const frameId = ${JSON.stringify(frameId)};
  const messageType = ${JSON.stringify(messageType)};
  const frontendOrigin = ${JSON.stringify(frontendOrigin)};
  const rules = ${JSON.stringify({
    syncParentTheme: Boolean(rules.syncParentTheme),
    syncHeightToParent: Boolean(rules.syncHeightToParent),
  })};

  let heightScheduled = false;

  const syncTheme = () => {
    if (!rules.syncParentTheme) return;

    try {
      const parentRoot = parent?.document?.documentElement;
      const parentTheme = parentRoot?.getAttribute("data-theme") || "light";
      const parentThemeColor = parentRoot?.getAttribute("data-theme-color") || "forest";
      document.documentElement.setAttribute("data-theme", parentTheme);
      document.documentElement.setAttribute("data-theme-color", parentThemeColor);

      const paletteLink = document.getElementById("theme-palette-stylesheet");
      if (paletteLink) {
        paletteLink.setAttribute("href", frontendOrigin + "/css/tokens." + parentThemeColor + ".css");
      }
    } catch {}
  };

  const sendHeight = () => {
    if (!rules.syncHeightToParent) return;

    const bodyHeight = document.body ? document.body.scrollHeight : 0;
    const htmlHeight = document.documentElement ? document.documentElement.scrollHeight : 0;
    const nextHeight = Math.max(bodyHeight, htmlHeight, 1);
    parent.postMessage({ type: messageType, frameId, height: nextHeight }, "*");
  };

  const scheduleHeight = () => {
    if (!rules.syncHeightToParent || heightScheduled) return;
    heightScheduled = true;
    requestAnimationFrame(() => {
      heightScheduled = false;
      sendHeight();
    });
  };

  syncTheme();

  if (rules.syncParentTheme) {
    try {
      const parentRoot = parent?.document?.documentElement;
      if (parentRoot) {
        new MutationObserver(() => {
          syncTheme();
          scheduleHeight();
        }).observe(parentRoot, {
          attributes: true,
          attributeFilter: ["data-theme", "data-theme-color"],
        });
      }
    } catch {}
  }

  if (rules.syncHeightToParent) {
    window.addEventListener("load", sendHeight);
    window.addEventListener("resize", scheduleHeight);
    new MutationObserver(scheduleHeight).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    sendHeight();
  }
})();
</script>`;
}

// Build the final srcdoc HTML for same-origin or DB-backed embedded content.
function buildFrameSrcDoc({ frameId, html, sourceUrl, messageType, rules, frontendOrigin, themeColor }) {
  const { title, headMarkup, bodyMarkup } = extractDocumentParts(html);
  const headParts = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  ];

  if (rules.includeBaseHref) {
    headParts.push(`<base href="${escapeHtmlAttribute(sourceUrl)}" />`);
  }

  if (title) {
    headParts.push(`<title>${escapeHtmlAttribute(title)}</title>`);
  }

  if (rules.injectSharedStylesheets) {
    headParts.push(buildSharedStylesheetLinks({ frontendOrigin, themeColor }));
  }

  headParts.push(headMarkup);

  if (rules.injectInlineBaseStyle) {
    headParts.push("<style>html,body{margin:0;padding:0;background:transparent;}</style>");
  }

  return `<!doctype html>
<html lang="en">
<head>
  ${headParts.join("\n  ")}
</head>
<body>${bodyMarkup}
${buildFrameBehaviorScript({ frameId, messageType, rules, frontendOrigin })}
</body>
</html>`;
}

function createFailureMarkup(message) {
  return `<p>${String(message || "Failed to load content.")}</p>`;
}

export function createEmbeddedDetailUi({
  mainEl,
  sectionDataAttribute,
  sectionDatasetKey,
  frameIdPrefix,
  messageType,
  failureMessage,
  failureLogLabel,
  loadHtml,
  sectionClassName = "page project-embedded-page",
  frameClassName = "project-embedded-frame",
  rules,
  frameOptions,
}) {
  const embedRules = normalizeEmbedRules(rules);
  const resolvedFrameOptions = normalizeFrameOptions(frameOptions);
  const embeddedFrameById = new Map();
  const sectionSelector = `section.page[${sectionDataAttribute}]`;
  const frontendOrigin = window.location.origin;
  const defaultDocumentTitle = document.title;

  // Create one sandboxed iframe using the configured defaults.
  const createSandboxedFrame = () => {
    const iframe = document.createElement("iframe");
    iframe.className = frameClassName;
    iframe.loading = resolvedFrameOptions.loading;
    iframe.referrerPolicy = resolvedFrameOptions.referrerPolicy;
    iframe.setAttribute("scrolling", resolvedFrameOptions.scrolling);
    iframe.setAttribute("sandbox", resolvedFrameOptions.sandbox);

    const frameId = `${frameIdPrefix}-${Math.random().toString(36).slice(2)}`;
    iframe.dataset.frameId = frameId;
    embeddedFrameById.set(frameId, iframe);
    return iframe;
  };

  const clearSection = (section) => {
    section.innerHTML = "";
  };

  const getMinimumFrameHeight = () => {
    try {
      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
      if (!viewportHeight) {
        return 1;
      }

      const headerHeight = document.querySelector("header")?.getBoundingClientRect?.().height || 0;
      const footerHeight = document.querySelector("footer")?.getBoundingClientRect?.().height || 0;
      const mainStyles = window.getComputedStyle(mainEl);
      const mainPaddingTop = Number.parseFloat(mainStyles.paddingTop || "0") || 0;
      const mainPaddingBottom = Number.parseFloat(mainStyles.paddingBottom || "0") || 0;
      const availableHeight = viewportHeight - headerHeight - footerHeight - mainPaddingTop - mainPaddingBottom;

      return Math.max(320, Math.round(availableHeight));
    } catch {
      return 1;
    }
  };

  const setParentDocumentTitle = (nextTitle) => {
    const normalizedTitle = String(nextTitle || "").trim();
    document.title = normalizedTitle || defaultDocumentTitle;
  };

  const removeDynamicSections = () => {
    document.querySelectorAll(sectionSelector).forEach((node) => node.remove());
    setParentDocumentTitle(defaultDocumentTitle);
  };

  // We keep only one dynamic embedded section at a time.
  const ensureSection = ({ sectionId, folder }) => {
    removeDynamicSections();

    const section = document.createElement("section");
    section.id = sectionId;
    section.className = sectionClassName;
    section.dataset[sectionDatasetKey] = folder;
    clearSection(section);
    mainEl.appendChild(section);
    return section;
  };

  const appendFrameToSection = (section, iframe) => {
    clearSection(section);
    section.appendChild(iframe);
  };

  const renderFailure = (section, error) => {
    console.error(failureLogLabel, error);
    section.innerHTML = createFailureMarkup(failureMessage);
  };

  const renderHtmlIntoSection = (section, html, sourceUrl) => {
    const iframe = createSandboxedFrame();
    const frameId = String(iframe.dataset.frameId || "");
    const { title } = extractDocumentParts(html);
    iframe.srcdoc = buildFrameSrcDoc({
      frameId,
      html,
      sourceUrl,
      messageType,
      rules: embedRules,
      frontendOrigin,
      themeColor: getCurrentThemeColor(),
    });
    appendFrameToSection(section, iframe);
    setParentDocumentTitle(title);
  };

  const renderCrossOriginUrlIntoSection = (section, sourceUrl) => {
    const iframe = createSandboxedFrame();
    iframe.src = sourceUrl;
    appendFrameToSection(section, iframe);
    setParentDocumentTitle(defaultDocumentTitle);
  };

  const renderUrlIntoSection = async (section, sourceUrl) => {
    try {
      if (isCrossOriginUrl(sourceUrl) && embedRules.useDirectIframeForCrossOrigin) {
        renderCrossOriginUrlIntoSection(section, sourceUrl);
        return;
      }

      if (typeof loadHtml !== "function") {
        throw new Error("Missing embedded content loader.");
      }

      const html = await loadHtml(sourceUrl);
      renderHtmlIntoSection(section, html, sourceUrl);
    } catch (error) {
      renderFailure(section, error);
    }
  };

  window.addEventListener("message", (event) => {
    const data = event?.data;
    if (!data || data.type !== messageType) return;

    const frame = embeddedFrameById.get(String(data.frameId || ""));
    if (!frame) return;

    const nextHeight = Number(data.height);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;

    frame.style.height = `${Math.max(getMinimumFrameHeight(), Math.round(nextHeight))}px`;
  });

  return {
    ensureSection,
    renderHtmlIntoSection,
    renderUrlIntoSection,
  };
}
