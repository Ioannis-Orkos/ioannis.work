# Frontend Refactor Report

## Quick audit

- `js/admin.js`, `js/project.js`, and `js/auth.js` had become multi-purpose controllers mixing DOM rendering, fetch calls, state, route behavior, and feature workflows.
- API communication lived inside feature files instead of a dedicated client layer, which made the frontend act like a pseudo-backend.
- Auth/session concerns were spread between UI code and low-level HTTP logic.
- Project and admin feature logic were tightly coupled to raw DOM nodes and inline request handling.
- Shared behaviors such as route parsing, embedded detail rendering, and reusable helpers were not clearly separated.

## New structure

```text
js/
  app/
    blog.js
    contact.js
    dom.js
    header-scroll.js
    main.js
    mobile-nav.js
    modals.js
    navigation.js
    theme.js
  api/
    admin-api.js
    auth-api.js
    content-api.js
    http.js
    projects-api.js
  features/
    admin/
      controller.js
      index.js
      modals.js
      render.js
      service.js
      state.js
    auth/
      dom.js
      index.js
      session-service.js
      session-store.js
      ui.js
    projects/
      controller.js
      index.js
      model.js
      request-access-modal.js
      service.js
      state.js
      ui.js
  shared/
    catalog.js
    config.js
    embedded-detail.js
    events.js
    html.js
    location.js
```

## What moved where

- App bootstrap and page-level wiring moved into `js/app/main.js`.
- Navigation, theme, modal routing, mobile nav, blog, and contact moved under `js/app`.
- All network calls moved into `js/api/http.js`, `js/api/auth-api.js`, `js/api/projects-api.js`, `js/api/admin-api.js`, and `js/api/content-api.js`.
- Auth/session state moved into `js/features/auth/session-store.js`.
- Auth session workflows moved into `js/features/auth/session-service.js`.
- Auth DOM lookup moved into `js/features/auth/dom.js`.
- Auth/login/settings UI syncing moved into `js/features/auth/ui.js`.
- Auth feature composition moved into `js/features/auth/index.js`.
- Project normalization, URL rules, and access rules moved into `js/features/projects/model.js`.
- Project rendering and filtering moved into `js/features/projects/ui.js`.
- Request-access modal behavior moved into `js/features/projects/request-access-modal.js`.
- Project feature state moved into `js/features/projects/state.js`.
- Project/API/auth workflow moved into `js/features/projects/service.js`.
- Project controller and DOM wiring moved into `js/features/projects/controller.js`.
- Admin rendering moved into `js/features/admin/render.js`.
- Admin modal builders moved into `js/features/admin/modals.js`.
- Admin feature state moved into `js/features/admin/state.js`.
- Admin data/mutation workflow moved into `js/features/admin/service.js`.
- Admin controller and DOM wiring moved into `js/features/admin/controller.js`.
- Top-level legacy files in `js/*.js` are now thin compatibility wrappers or entry shims.

## Separation result

- `js/api/*`: transport layer only, no DOM decisions.
- `js/features/*/service.js`: feature workflows and API orchestration.
- `js/features/*/state.js`: feature-local mutable state.
- `js/features/*/controller.js` or `index.js`: DOM event wiring and page coordination.
- `js/features/*/ui.js` and `render.js`: rendering and display logic only.
- `js/shared/*`: cross-feature utilities with no feature-specific ownership.

## Verification

- Parsed all JS files with `node --experimental-default-type=module --check`.
- Ran an import-resolution sanity check across the `js/` tree.

## Notes

- The old top-level entry points still exist as wrappers so existing references continue to work.
- Empty `js/core` and `js/modules` directories appear to be leftovers from outside this refactor; removing them was blocked by the environment policy.
