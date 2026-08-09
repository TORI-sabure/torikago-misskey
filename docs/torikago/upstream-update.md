# Updating Torikago Misskey from upstream

The commands below use merge commits. This avoids rewriting the deployed branch
and does not require a force push.

## One-time setup

```sh
git remote add upstream https://github.com/misskey-dev/misskey.git
git remote -v
```

If `upstream` already exists, verify that it points to the official repository
instead of adding it again.

## Regular update procedure

```sh
git status
git fetch origin
git fetch upstream

git switch develop
git pull --ff-only origin develop
git merge --ff-only upstream/develop
git push origin develop

git switch feature/hashtag-search-mutual-timeline
git pull --ff-only origin feature/hashtag-search-mutual-timeline
git merge develop
```

Resolve any conflicts before continuing. Do not resolve a whole file with
`--ours` or `--theirs`; retain both the current upstream behavior and the small
Torikago integration described in `docs/torikago/customizations.md`.

Then validate and publish:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter frontend test
pnpm --filter backend test
node scripts/check-spdx.mjs

git status
git push origin feature/hashtag-search-mutual-timeline
```

Run the test-environment workflow with
`feature/hashtag-search-mutual-timeline` as the branch or commit to deploy, and
confirm at least the following on a real client:

- chat text remains visible while composing on iOS Safari;
- hashtag search and five trends are displayed;
- mutual timeline shows own and mutual-account notes after reload;
- mutual notes arrive in real time and non-mutual notes do not;
- the mutual tab and tip follow the selected language;
- post visibility is remembered by default for a new account/device setting.

## When upstream changes the same area

Use the customization inventory to identify why the Torikago lines exist. Prefer
adapting the small integration to the new upstream API over restoring the old
upstream implementation. If an upstream release implements an equivalent feature,
remove the Torikago implementation and use upstream rather than maintaining both.

After a successful production deployment, tag the deployed commit so rollback is
straightforward:

```sh
git tag torikago-YYYYMMDD
git push origin torikago-YYYYMMDD
```


