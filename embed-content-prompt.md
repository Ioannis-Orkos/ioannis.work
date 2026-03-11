# Embeddable Blog / Project Prompt

Use this prompt when generating future embedded blogs or projects for `ioannis.work`.

```text
Create a new embeddable content page for my ioannis.work site.

Important references:
- Use `projects/unit-converter/embed.html` as the main reference for embedded project/tool style.
- Use the current local route pattern:
  - `index.html` is a tiny public route wrapper
  - `embed.html` is the actual iframe content
- Keep the result compatible with the way my site embeds local HTML inside a sandbox iframe.
- If creating a blog/article, keep it cleaner and narrower than the tool example, but still in the same visual family.

Choose one content type:
- `project`
- `blog`

Follow these exact integration rules:

- Output complete local HTML files.
- If content type is `project`, generate:
  - `projects/[folder]/index.html`
  - `projects/[folder]/embed.html`
- If content type is `blog`, generate:
  - `blogs/[folder]/index.html`
  - `blogs/[folder]/embed.html`

Public route wrapper rules for `index.html`:
- Keep it very small and lightweight.
- It should not contain the full project or blog markup.
- It should immediately redirect into the parent site shell.
- Use this redirect pattern:

  For projects:
  <script>
    window.location.replace("/#project-[folder]");
  </script>

  For blogs:
  <script>
    window.location.replace("/#blog-[folder]");
  </script>

- You may include a matching `<meta http-equiv="refresh">`.
- A tiny “Opening…” message is fine.

Embedded content rules for `embed.html`:
- The page will be loaded inside a sandbox iframe on the parent site.
- It must work as embedded content first, not as a standalone landing page.
- Include a standalone guard near the top so direct visits to `embed.html` go back to the public route wrapper:

  For projects:
  <script>
    if (window.top === window.self) {
      window.location.replace("/projects/[folder]/");
    }
  </script>

  For blogs:
  <script>
    if (window.top === window.self) {
      window.location.replace("/blogs/[folder]/");
    }
  </script>

- Use plain HTML, CSS, and vanilla JavaScript only.
- No React, Vue, Angular, Tailwind, Bootstrap, or external UI libraries.
- Keep everything self-contained in `embed.html` unless local relative assets are needed.
- Relative assets should be referenced from the content folder, for example:
  - `./asset/preview.webp`
  - `./test.webp`
- Do not add a global site navbar, footer, sidebar, or standalone app shell.
- The parent site already injects:
  - shared fonts
  - reset styles
  - theme variables
  - public site CSS
- The parent site also syncs light/dark theme automatically.
- Use CSS variables with fallbacks, for example:
  - `--color-body`
  - `--color-surface`
  - `--color-body-text`
  - `--color-border`
  - `--box-shadow`
  - `--color-nav-active-hover`
  - `--font-body`
  - `--font-heading`
- Make it blend into the parent site when embedded in an iframe.
- Do not rely on parent DOM access.
- Do not implement your own iframe resizing script.
- No full page reload behavior for normal interactions.
- Keep the page readable on mobile and desktop.

Design rules for projects:
- Match the spirit of `projects/unit-converter/embed.html`
- compact centered header
- practical card-based layout
- rounded corners
- subtle borders and shadows
- clean responsive spacing
- lightweight vanilla JavaScript
- polished but simple interaction design
- embedded-content-first layout, not a standalone marketing page
- good for tools, demos, utilities, and interactive project pages

Design rules for blogs:
- Same visual family as the site, but simpler and more editorial
- narrower readable column
- clear headings, paragraphs, lists, code/image blocks if needed
- no giant hero section
- no marketing-page layout
- no heavy chrome around the article
- calm spacing, readable rhythm, and subtle content sections

Shared design constraints:
- no giant hero section
- no standalone landing page feel
- no duplicated site branding
- no heavy animation
- no framework-style component boilerplate
- no aggressive global CSS reset
- no dark background by default unless clearly needed
- use concise helper text and practical labels
- keep interactions local, small, and useful

Layout guidance:
- For projects/tools: 1 to 3 main cards/sections is preferred
- For blogs/articles: use a clean reading layout with sensible content width
- Keep spacing and proportions close to the unit converter reference where appropriate

Also generate:
1. The full HTML for `index.html`
2. The full HTML for `embed.html`
3. The suggested JSON catalog entry
4. A short description
5. A suggested preview image path if relevant

Catalog rule:
- If content type is `project`, also generate an entry for `projects/projects-data.json`
- If content type is `blog`, also generate an entry matching the structure used in `blogs/blog-data.json`
- If you include a `url` field in the catalog entry for local embedded content, point it to `[folder]/embed.html`

Content details:
- content type: [project or blog]
- folder: [folder]
- title: [title]
- date: [yyyy-mm-dd]
- description: [short description]
- categories: [category1, category2, category3]
- feature list or sections: [list]
- visual style: based on my existing embedded site content

Output goal:
Make the result feel native to ioannis.work when embedded inside the parent page, while keeping direct public URLs lightweight and clean.
```
