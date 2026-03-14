# Embedded Content Prompt

Use this prompt when generating future embedded content for `ioannis.work`.

It now supports two delivery modes:
- `folder` content
- `database` content

`folder` mode is for local files stored in the frontend repo.
`database` mode is for single HTML content stored in the backend/content system and loaded into the iframe from the API.

```text
Create a new embedded content page for my ioannis.work site.

Choose one delivery mode:
- `folder`
- `database`

Choose one content section:
- `project`
- `blog`
- `aviation`

Important references:
- Use `project/unit-converter/index.html` as the main reference for embedded tool/project structure and proportion.
- Match the current frontend route system:
  - local folder content uses `index.html`
  - database content is stored as one single HTML document
- Keep the result compatible with the way my site loads content into a sandbox iframe.
- The final result must feel native inside the parent site, not like a separate standalone app.

Follow these exact integration rules.

Shared technical rules:
- Use plain HTML, CSS, and vanilla JavaScript only.
- No React, Vue, Angular, Tailwind, Bootstrap, or external UI libraries.
- The parent site already injects:
  - shared fonts
  - reset styles
  - theme variables
  - public site CSS
- The parent site also syncs:
  - `data-theme`
  - `data-theme-color`
- Do not add your own iframe resizing script.
- Do not rely on parent DOM access for layout or interaction.
- Keep all interactions local to the embedded document.
- Keep the page responsive on mobile and desktop.
- Use CSS variables with fallbacks where useful, especially:
  - `--color-body`
  - `--color-surface`
  - `--color-body-text`
  - `--color-border`
  - `--box-shadow`
  - `--color-nav-active-hover`
  - `--font-body`
  - `--font-heading`

Design rules for `project`:
- Practical and compact
- Card-based sections are preferred
- Clean controls and readable outputs
- Rounded corners, subtle borders, light shadows
- Good fit for tools, demos, utilities, references

Design rules for `blog`:
- Editorial and calm
- Narrower reading layout
- Clear hierarchy for headings, body text, lists, and media
- No oversized hero or marketing-page feel

Design rules for `aviation`:
- Structured and reference-friendly
- Good for maintenance notes, procedures, aircraft reference content, or technical summaries
- Clear tables, cards, callouts, and image support
- Professional, practical, easy to scan

Shared design constraints:
- No giant hero section
- No duplicated site navbar, footer, or full shell
- No heavy animation
- No aggressive global reset
- No dark background by default unless the content clearly needs it
- Use concise labels and helper text
- Keep spacing simple and readable

Layout guidance:
- For tools/reference pages: 1 to 4 main sections/cards is preferred
- For editorial pages: one readable main column with optional side blocks only if clearly helpful
- Keep spacing and proportions close to the unit converter reference when appropriate

Mode-specific rules:

1. Folder mode
- Output complete local frontend files.
- Use singular folders, not plural ones.
- If section is `project`, generate:
  - `project/[folder]/index.html`
- If section is `blog`, generate:
  - `blog/[folder]/index.html`
- If section is `aviation`, generate:
  - `aviation/[folder]/index.html`
- The HTML should work embedded first.
- Include a standalone guard near the top so direct visits redirect back into the parent site shell.

Standalone guard pattern:

  For `project`:
  <script>
    if (window.top === window.self) {
      window.location.replace("/#project-[folder]");
    }
  </script>

  For `blog`:
  <script>
    if (window.top === window.self) {
      window.location.replace("/#blog-[folder]");
    }
  </script>

  For `aviation`:
  <script>
    if (window.top === window.self) {
      window.location.replace("/#aviation-[folder]");
    }
  </script>

- Keep everything self-contained in `index.html` unless local relative assets are needed.
- Relative assets should be referenced from the same folder, for example:
  - `./asset/preview.webp`
  - `./diagram.webp`
  - `./table-image.webp`

Folder mode output:
1. The full HTML for `index.html`
2. The suggested catalog entry
3. A short description
4. A suggested preview image path if relevant

Folder mode catalog rule:
- If section is `project`, generate an entry for `project/project-data.json`
- If section is `blog`, generate an entry matching `blog/blog-data.json`
- If section is `aviation`, generate an entry matching `aviation/aviation-data.json`
- For local content, if a `url` field is used, point it to `[folder]/index.html`

2. Database mode
- Output one single self-contained HTML document only.
- Do not rely on `fetch()` to load local JSON, config files, or tab files at runtime.
- Inline all content data directly inside the HTML.
- If images are needed, use frontend-resolvable absolute paths or resolve them from the frontend origin so the content still works when loaded from the API iframe context.
- Database content must be safe to store as a single HTML body and render inside the iframe without extra file dependencies.
- Do not include redirect wrappers or public route wrapper pages in database mode.
- The document should be embeddable first, with no extra shell.

Database mode asset rule:
- Prefer asset paths that resolve against the frontend origin, not the API origin.
- If you need runtime asset resolution, use a lightweight helper that tries:
  - `window.location.ancestorOrigins[0]`
  - then `document.referrer`
  - then `window.location.origin`

Database mode output:
1. One complete single-file HTML document
2. Suggested content metadata for admin/content entry
3. Suggested `section` value:
  - `project`
  - `blog`
  - `aviation`
4. Suggested title
5. Suggested description

Content details:
- delivery mode: [folder or database]
- section: [project, blog, or aviation]
- folder: [folder, only if folder mode]
- title: [title]
- date: [yyyy-mm-dd if relevant]
- description: [short description]
- categories: [category1, category2, category3]
- sections or feature list: [list]
- visual style: based on my existing embedded site content

Output goal:
Make the content feel native to ioannis.work inside the iframe, while matching the correct storage mode:
- `folder` for frontend file-based content
- `database` for single HTML stored in backend content
```
