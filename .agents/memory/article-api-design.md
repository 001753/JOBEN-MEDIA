---
name: Article API design decisions
description: Key design choices for the JOBEN NEWS Article content type and its access control
---

## Editorial state machine
- `editorial_status` enum: draft → review → published
- `draftAndPublish: true` is used; lifecycle hook syncs `editorial_status` ↔ `publishedAt`
- `published` → `publishedAt = new Date()`; `draft`/`review` → `publishedAt = null`
- Public REST API automatically excludes `publishedAt = null` entries

## Strapi v5 response shape (IMPORTANT)
- v5 REST responses are **flat**: `response.data.editorial_status` (NOT `response.data.attributes.editorial_status`)
- `ctx.params.id` in routes = `documentId` (UUID string), not numeric `id`
- Use `strapi.documents('api::article.article').findOne({ documentId })` for Document Service
- Use `strapi.db.query().findOne({ where: { id } })` only when you have numeric id

## Ownership policy (is-own-article)
- Penulis role: can only edit their own articles — checked via `author.documentId` match
- Editor/Super Admin: can edit any article
- Policy applied only to PUT/DELETE routes
- Additional check: Penulis cannot set `editorial_status = 'published'`

## Breaking news enforcement
- Only 1 article can have `is_breaking_news = true` at a time
- Enforcement: `beforeUpdate` does atomic `updateMany` to reset all OTHER articles before setting current one
- No pre-check (avoids TOCTOU race), just always reset others first

## Create endpoint auth
- No route-level policy needed; controller checks `ctx.state.user` directly and returns 401 if not logged in
- Penulis: author auto-assigned from their Author profile; editorial_status forced to 'draft'

**Why:** Decisions made to match PRD v1.2 requirements and Strapi v5 API patterns.
