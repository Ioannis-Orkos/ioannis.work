# Frontend Refactor Report

## Audit

- The previous frontend still mixed responsibilities across `js/app/` and `js/features/`.
- Auth, projects, and admin logic lived beside DOM rendering and modal behavior.
- The admin feature created modal markup in JavaScript instead of keeping modal UI in HTML.
- API transport depended on auth feature state, so backend communication was not isolated.
- CSS was grouped in broad root files (`base.css`, `modal.css`, `header.css`, `footer.css`) instead of component/feature ownership.

## New structure

```text
js/
  app/
    dom.js
    main.js
  api/
    admin-api.js
    auth-api.js
    contact-api.js
    content-api.js
    endpoints.js
    http.js
    projects-api.js
    token-store.js
  logic/
    admin/
      admin-controller.js
      admin-service.js
      admin-state.js
    auth/
      auth-controller.js
      auth-service.js
      session-state.js
    blog/
      blog-controller.js
    contact/
      contact-controller.js
    projects/
      projects-controller.js
      projects-model.js
      projects-service.js
      projects-state.js
  shared/
    catalog.js
    config.js
    events.js
    html.js
    location.js
  ui/
    admin/
      admin-modals-ui.js
      admin-ui.js
    auth/
      auth-ui.js
    blog/
      blog-ui.js
    contact/
      contact-ui.js
    projects/
      projects-ui.js
      request-access-ui.js
    shared/
      embedded-detail-ui.js
    shell/
      header-scroll-ui.js
      mobile-nav-ui.js
      modal-router-ui.js
      navigation-ui.js
      theme-ui.js

css/
  components/
    footer.css
    header.css
    layout.css
    modal.css
  features/
    about.css
    admin.css
    auth.css
    catalog.css
    contact.css
    request-access.css
    settings.css
  reset.css
  styles.css
  tokens*.css
```

## Separation rules now applied

- `js/ui/*`: DOM behavior only. These modules read elements, bind events, toggle classes, reset forms, and render data.
- `js/logic/*`: workflow coordination. These modules decide auth flow, admin flow, project access flow, and contact form rules.
- `js/api/*`: backend and third-party communication only. Endpoints, token storage, request normalization, and transport live here.
- `js/shared/*`: cross-cutting helpers with no feature ownership.
- `css/components/*`: shared UI building blocks.
- `css/features/*`: page and modal styling grouped by feature.

## Modal handling

- All modal markup now lives in `index.html`.
- Admin modals are no longer assembled in JavaScript.
- Modal open/close routing stays in `js/ui/shell/modal-router-ui.js`.
- Feature-specific modal behavior now lives in:
  - `js/ui/auth/auth-ui.js`
  - `js/ui/contact/contact-ui.js`
  - `js/ui/projects/request-access-ui.js`
  - `js/ui/admin/admin-modals-ui.js`

## New files

- `js/api/contact-api.js`
- `js/api/endpoints.js`
- `js/api/token-store.js`
- `js/logic/admin/admin-controller.js`
- `js/logic/admin/admin-service.js`
- `js/logic/admin/admin-state.js`
- `js/logic/auth/auth-controller.js`
- `js/logic/auth/auth-service.js`
- `js/logic/auth/session-state.js`
- `js/logic/blog/blog-controller.js`
- `js/logic/contact/contact-controller.js`
- `js/logic/projects/projects-controller.js`
- `js/logic/projects/projects-model.js`
- `js/logic/projects/projects-service.js`
- `js/logic/projects/projects-state.js`
- `js/ui/admin/admin-modals-ui.js`
- `js/ui/admin/admin-ui.js`
- `js/ui/auth/auth-ui.js`
- `js/ui/blog/blog-ui.js`
- `js/ui/contact/contact-ui.js`
- `js/ui/projects/projects-ui.js`
- `js/ui/projects/request-access-ui.js`
- `js/ui/shared/embedded-detail-ui.js`
- `js/ui/shell/header-scroll-ui.js`
- `js/ui/shell/mobile-nav-ui.js`
- `js/ui/shell/modal-router-ui.js`
- `js/ui/shell/navigation-ui.js`
- `js/ui/shell/theme-ui.js`
- `css/components/footer.css`
- `css/components/header.css`
- `css/components/layout.css`
- `css/components/modal.css`
- `css/features/about.css`
- `css/features/admin.css`
- `css/features/auth.css`
- `css/features/catalog.css`
- `css/features/contact.css`
- `css/features/request-access.css`
- `css/features/settings.css`

## Updated files

- `index.html`
- `css/styles.css`
- `js/app/main.js`
- `js/api/admin-api.js`
- `js/api/auth-api.js`
- `js/api/http.js`
- `js/api/projects-api.js`
- `js/shared/config.js`

## Removed files

- `css/base.css`
- `css/footer.css`
- `css/header.css`
- `css/modal.css`
- `js/app/blog.js`
- `js/app/contact.js`
- `js/app/header-scroll.js`
- `js/app/mobile-nav.js`
- `js/app/modals.js`
- `js/app/navigation.js`
- `js/app/theme.js`
- `js/features/admin/*`
- `js/features/auth/*`
- `js/features/projects/*`
- `js/shared/embedded-detail.js`

## Verification

- Parsed all JavaScript modules with `node --experimental-default-type=module --check`.
- Searched the active source tree for old `js/features/*` imports and old CSS file imports after the refactor.

## Note

- Empty legacy directories may remain if they were already present in the repo, but the active frontend no longer imports from them.
