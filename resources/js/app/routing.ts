import type { AuthUser } from '../core/types';

const adminPagePaths: Record<string, string> = {
  "platform-dashboard": "/admin",
  factories: "/admin/factories",
  "platform-users": "/admin/users",
  subscriptions: "/admin/subscriptions",
  announcements: "/admin/announcements",
  notifications: "/admin/notifications",
  "support-center": "/admin/support",
  backups: "/admin/backups",
  "system-settings": "/admin/settings",
};
const adminPathPages = Object.fromEntries(Object.entries(adminPagePaths).map(([page, path]) => [path, page]));

export function pageKeyFromPath(user: AuthUser, rawPath: string): string {
  const path = rawPath.replace(/\/$/, "") || "/";
  if (user.is_platform_admin) return path === "/admin/profile" ? "profile" : adminPathPages[path] || "platform-dashboard";
  const parts = path.split("/").filter(Boolean);
  const page = parts.length > 1 ? parts[1] : "dashboard";
  return ({ report: "reports", users: "team", products_bom: "products" } as Record<string, string>)[page] || page;
}

export function pageFromLocation(user: AuthUser): string {
  return pageKeyFromPath(user, window.location.pathname);
}

export function pathForPage(user: AuthUser, page: string): string {
  if (user.is_platform_admin) return page === "profile" ? "/admin/profile" : adminPagePaths[page] || "/admin";
  const workspace = user.workspace || "operations";
  return page === "dashboard" ? `/${workspace}` : `/${workspace}/${page}`;
}
