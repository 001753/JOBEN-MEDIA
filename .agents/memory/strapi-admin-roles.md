---
name: Strapi v5 admin roles bootstrap
description: How to create admin panel roles programmatically in Strapi v5 bootstrap
---

# Strapi v5 Admin Roles via Bootstrap

## Rule
Use `strapi.db.query('admin::role')` directly — NOT `strapi.service('admin::role')`.

`strapi.service('admin::role').findAll()` does NOT exist in Strapi v5 and throws `roleService.findAll is not a function`.

## Working pattern
```js
const existingRoles = await strapi.db.query('admin::role').findMany({ select: ['name', 'code'] });
await strapi.db.query('admin::role').create({ data: { name, description, code } });
```

**Why:** Strapi v5 moved admin role management away from service layer to direct DB query for internal admin models.

**How to apply:** Any time you need to create/read admin panel roles in a Strapi v5 bootstrap() or script.
