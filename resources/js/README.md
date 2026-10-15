# Frontend guide

The app is a React + TypeScript single-page app. `app.tsx` only starts it. Everything else lives in one of these folders.

| Folder | What is inside |
| --- | --- |
| `core/` | Things every part needs: `api.ts` (fetch helper), `types.ts` (user and notification types), `labels.ts` (menu text in English and French). |
| `app/` | The frame around every page: `AppShell.tsx` (puts it together), `Sidebar.tsx`, `Topbar.tsx`, `PageRouter.tsx` (which page shows for which name), `navigation.ts` (who may see which menu item), and `hooks/` (small helpers such as notifications and the offline banner). |
| `auth/` | Sign in, register, forgot password and reset password. |
| `roles/` | **One folder per kind of user.** See below. |
| `pages/` | Screens that several roles share (stock, sales, finance, quality, reports...). Production work screens are grouped by industry and stage, see below. |

## Roles: one folder per kind of user

```
roles/
  owner/                  the factory owner
    index.ts              menu items and who counts as an owner
    OwnerDashboard.tsx    the owner's home page
    OwnerActivityPage.tsx the "Factory activity" page
    sections/             one small file per card on the dashboard (money, production, stock...)
    components/           pieces reused inside the owner pages
    text.ts               every English and French sentence the owner pages show
  warehouse/  logistics/  school/  cutting/  sewing/  ...   same idea
  registry.ts             the list of roles, in the order they are checked
  flags.ts                works out which roles a signed-in user has
  home.ts                 which home page a user sees
```

To change what a role sees in the menu, open `roles/<role>/index.ts`.
To change a role's home page, open the page file in the same folder.
To add a new role: copy a small folder such as `roles/sales/`, change its `matches` rule and menu, then add it to the list in `registry.ts`. Put it above any role it should win over, because the first match is used.

## Production screens: one folder per industry, one per stage

Different factories have different production stages, so the work screens for each stage live under `pages/production/<industry>/<stage>/`:

```
pages/production/
  shared.tsx, MachinesPage.tsx, ...   used by every industry
  textile/                            clothing and textile factories
    cutting/   CuttingWorkspacePage.tsx
    sewing/    SewingWorkspacePage.tsx      (the sewing line)
    finishing/ FinishingWorkspacePage.tsx
    packing/   PackingWorkspacePage.tsx
```

To add an industry, for example dairy, create `pages/production/dairy/` with one folder per stage (`receiving/`, `pasteurising/`, `packing/`...). Then add the menu entries for the people who work there in `roles/` and the page names in `app/PageRouter.tsx`. Only textile has stage screens today. The other industries use the general production pages until their stage screens are built.

## Rules of thumb

- Text shown to people must exist in English and French.
- A screen used by only one role belongs in that role's folder. A screen used by several roles belongs in `pages/`. A production stage screen belongs in `pages/production/<industry>/<stage>/`.
- Keep each file small enough to read in one sitting. If a file grows past a few hundred lines, split it.
