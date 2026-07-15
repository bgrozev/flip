/**
 * Pure routing helpers: URL scheme for panels and the map.
 *
 * Scheme: the map lives at `/` (no panel open); each panel is `/${panelId}`
 * (`/pattern`, `/wind`, ...). `/map` is a legacy alias for `/`.
 */
import { PANEL_IDS, PanelId } from '../types';

/** The map (no panel open). */
export const MAP_PATH = '/';

/** Legacy alias for the map; the fake router used `/map` as its home path. */
export const LEGACY_MAP_PATH = '/map';

/** Route path for a panel. */
export function panelPath(id: PanelId): string {
  return `/${id}`;
}

/** Strips trailing slashes: '/wind/' -> '/wind', '///' -> '/'. */
function normalizePathname(pathname: string): string {
  const stripped = pathname.replace(/\/+$/, '');

  return stripped === '' ? '/' : stripped;
}

/** True when the pathname shows the bare map (root or legacy /map). */
export function isMapPathname(pathname: string): boolean {
  const p = normalizePathname(pathname);

  return p === MAP_PATH || p === LEGACY_MAP_PATH;
}

/** The panel a pathname addresses, or null when it isn't a panel route. */
export function panelFromPathname(pathname: string): PanelId | null {
  const p = normalizePathname(pathname);
  const segment = p.startsWith('/') ? p.slice(1) : p;

  return (PANEL_IDS as readonly string[]).includes(segment) ? segment as PanelId : null;
}

/**
 * Route guard: is this pathname reachable given the allowed panels?
 * The map is always reachable; a panel must be in `allowedPanels`.
 * Unknown paths are not allowed (callers redirect to the map).
 */
export function isPathnameAllowed(pathname: string, allowedPanels: readonly PanelId[]): boolean {
  if (isMapPathname(pathname)) {
    return true;
  }

  const panel = panelFromPathname(pathname);

  return panel !== null && allowedPanels.includes(panel);
}
