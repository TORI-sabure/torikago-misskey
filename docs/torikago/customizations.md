# Torikago Misskey customizations

This document is the inventory of intentional differences from upstream Misskey.
Keep fork-specific implementation in new files where practical, and keep edits to
upstream files limited to small integration points.

## Current customizations

| Feature | Fork-owned implementation | Upstream integration points |
| --- | --- | --- |
| iOS chat input visibility | CSS-only fix | `packages/frontend/src/pages/chat/room.form.vue` |
| Hashtag search and trends | `packages/frontend/src/pages/search.tag.vue` | `search.vue`, `search.stories.impl.ts` |
| Mutual timeline | `packages/frontend/src/torikago/i18n.ts` | timeline endpoint, home stream channel, timeline component/page/store/type list |
| Remember post visibility by default | none | `packages/frontend/src/preferences/def.ts` (one default value) |
| Fork version identity | none | root `package.json` |

The test-deployment workflow intentionally remains identical to upstream.

## Rules for future changes

1. Put new fork-owned frontend modules under `packages/frontend/src/torikago/`.
2. Put new fork-owned backend modules under `packages/backend/src/torikago/` when a
   feature is large enough to extract. Keep dependency-injection and routing edits
   in upstream files as small as possible.
3. Do not edit locale YAML files other than `locales/ja-JP.yml`. Fork-only strings
   that cannot go through upstream Crowdin belong in the Torikago translation
   module instead.
4. Do not copy an entire upstream component or service merely to change a small
   condition. A small integration patch receives upstream bug fixes more reliably.
5. Add every new customization and every touched upstream integration point to
   this table.
6. Keep unrelated features in separate commits so conflicts can be resolved or a
   feature can be temporarily reverted independently.


