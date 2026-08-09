/**
 * Provider-neutral map adapter.
 *
 * Defines the primitive building blocks (component prop contracts, contexts
 * and hooks) that map layers are written against. The active provider
 * implementation (currently Google Maps, `./google/`) supplies concrete
 * components for these contracts and populates the contexts; `./index.ts`
 * binds the two together.
 *
 * Nothing in this file — and nothing in `./layers/` — may reference a
 * concrete map provider (`google.maps`, `@react-google-maps/api`, ...).
 */
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { LatLng, MapProvider } from '../types';

/** Initial zoom level applied when the map loads. */
export const DEFAULT_ZOOM = 17;

/** Default mouse cursor over the map when no layer overrides it. */
export const DEFAULT_CURSOR = 'grab';

// ---------------------------------------------------------------------------
// Primitive component contracts (implemented by the provider)

/**
 * The map itself. Renders a full-size map inside a relatively-positioned
 * wrapper element, provides the adapter contexts to its children, and shows
 * a loading placeholder until the provider is ready.
 */
export interface MapContainerProps {
  /** Map camera center: applied on load and panned to when it changes. */
  center: LatLng;
  /**
   * Initial zoom level: applied on load and re-applied when the value
   * changes (e.g. a mode switch wanting a wider view). User zooming in
   * between is left alone.
   */
  initialZoom?: number;
  /**
   * Show place/road labels over the satellite imagery. Only the Google
   * provider has a labeled variant (`hybrid`); MapLibre's raster style has
   * no label layer, so it has nothing to toggle.
   */
  showLabels?: boolean;
  children?: React.ReactNode;
}

/**
 * Props of the top-level `MapContainer` dispatcher: a `MapContainerProps`
 * plus the provider to render. Each concrete provider container itself
 * takes only `MapContainerProps`.
 */
export interface MapDispatchContainerProps extends MapContainerProps {
  /** Which provider implementation to mount. Defaults to `'google'`. */
  provider?: MapProvider;
}

/** A polyline on the map. */
export interface MapPolylineProps {
  path: LatLng[];
  /** Stroke color (CSS color string). */
  color: string;
  /** Stroke opacity 0..1 (default 1). Ignored when `dotted` is set. */
  opacity?: number;
  /** Stroke width in pixels (default 2). */
  weight?: number;
  zIndex?: number;
  /** Whether the line intercepts mouse events (default false). */
  clickable?: boolean;
  /** Render as a dotted line instead of a solid one. */
  dotted?: boolean;
}

/** Visual style of a circle with a geographic (meter) radius. */
export interface MapCircleStyle {
  /** Radius in meters. */
  radius: number;
  fillColor?: string;
  /** 0..1 */
  fillOpacity?: number;
  strokeColor?: string;
  /** 0..1 */
  strokeOpacity?: number;
  /** Stroke width in pixels. */
  strokeWeight?: number;
  zIndex?: number;
  /** Whether the circle intercepts mouse events (default false). */
  clickable?: boolean;
}

/** A circle on the map (radius in meters, so it scales with zoom). */
export interface MapCircleProps extends MapCircleStyle {
  center: LatLng;
  onClick?: () => void;
  onMouseOver?: () => void;
  onMouseOut?: () => void;
}

/**
 * Arbitrary DOM content anchored at a geographic position, rendered in a
 * pane that receives DOM mouse events (children may use pointer events).
 * Children are anchored at the position's pixel location; use CSS
 * transforms to center/offset them.
 */
export interface MapOverlayProps {
  position: LatLng;
  children: React.ReactNode;
}

/**
 * A draggable circular handle (screen-fixed size), used for direct
 * manipulation of positions/headings on the map.
 */
export interface MapDragHandleProps {
  position: LatLng;
  /** Fill color of the handle. */
  color: string;
  /** Handle size (radius in screen pixels). */
  scale: number;
  /** Mouse cursor shown while hovering the handle. */
  cursor?: string;
  zIndex?: number;
  /** Fired continuously while dragging. */
  onDrag?: (pos: LatLng) => void;
  /** Fired when the drag ends, with the final position. */
  onDragEnd: (pos: LatLng) => void;
  /** Fired on a click/tap of the handle (no drag). */
  onClick?: () => void;
  onMouseOver?: () => void;
  onMouseOut?: () => void;
  /**
   * Keep the handle glued to its controlled `position` throughout the drag
   * (it never chases the pointer). Use for rotation handles that live on a
   * line: the drag reads the pointer only for the angle, while the handle
   * stays on the line as it swings.
   */
  pinned?: boolean;
}

// ---------------------------------------------------------------------------
// Provider selection

/**
 * The active map provider for the current map subtree. `MapContainer`
 * provides this (from the `provider` prop fed by settings) so that the
 * primitive dispatchers (`MapPolyline`, `MapCircle`, ...) can render the
 * matching provider implementation. Defaults to `'google'`.
 */
export const MapProviderContext = createContext<MapProvider>('google');

/** The active map provider inside a `MapContainer` subtree. */
export function useMapProvider(): MapProvider {
  return useContext(MapProviderContext);
}

// ---------------------------------------------------------------------------
// Contexts (populated by the provider's MapContainer)

/**
 * Interaction registry: layers register map-click handlers and cursor
 * overrides through the hooks below; the container dispatches clicks to the
 * highest-priority handler and applies the most recent cursor override.
 */
/** Modifier keys held during a map click. */
export interface MapClickModifiers {
  shift: boolean;
}

/** How a registered click handler takes part in a background click. */
export interface MapClickOptions {
  /**
   * Watch every background click instead of competing for it. An observer is
   * always notified and never consumes the click, so the layer that owns the
   * gesture still gets it. For behaviour that hangs off "the map was pressed"
   * rather than "the map was pressed AT this point" — closing a panel, say.
   */
  observe?: boolean;
}

export interface MapInteractions {
  /** Register a map click handler. Returns an unregister function. */
  registerClickHandler: (
    handler: (pos: LatLng, mods: MapClickModifiers) => void,
    priority: number,
    options?: MapClickOptions
  ) => () => void;
  /** Register a cursor override. Returns a function removing the override. */
  registerCursor: (cursor: string) => () => void;
  /**
   * Mark that a drag handle is (or is not) being dragged. While dragging, the
   * container suppresses camera panning so moving a handle never scrolls the
   * map (e.g. the camera would otherwise chase a target-follow re-centre).
   */
  setHandleDragging: (dragging: boolean) => void;
}

export const MapInteractionsContext = createContext<MapInteractions | null>(null);

/**
 * Hook for a drag handle to bracket its drag so the map camera stays put
 * for the duration. Returns start/end callbacks; no-ops with no provider.
 */
export function useHandleDrag(): { start: () => void; end: () => void } {
  const interactions = useContext(MapInteractionsContext);
  return {
    start: () => interactions?.setHandleDragging(true),
    end: () => interactions?.setHandleDragging(false)
  };
}

/** Camera state exposed to layers. */
export interface MapViewState {
  zoom: number;
}

export const MapViewContext = createContext<MapViewState>({ zoom: DEFAULT_ZOOM });

/**
 * Host element for screen-anchored map controls (buttons, HUD elements).
 * Set by the provider to the map's wrapper element.
 */
export const MapControlHostContext = createContext<HTMLElement | null>(null);

// ---------------------------------------------------------------------------
// Hooks and helpers for layers

/** Current map zoom level. */
export function useMapZoom(): number {
  return useContext(MapViewContext).zoom;
}

/**
 * Handle clicks on the map background. When several layers are interested,
 * only the enabled handler with the highest priority receives the click —
 * unless it registers with `observe`, which watches without competing.
 */
export function useMapClick(
  handler: (pos: LatLng, mods: MapClickModifiers) => void,
  { enabled = true, priority = 0, observe = false }:
    { enabled?: boolean; priority?: number; observe?: boolean } = {}
): void {
  const interactions = useContext(MapInteractionsContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!interactions || !enabled) {
      return undefined;
    }

    return interactions.registerClickHandler(
      (pos, mods) => handlerRef.current(pos, mods),
      priority,
      { observe }
    );
  }, [interactions, enabled, priority, observe]);
}

/**
 * Override the map's mouse cursor while `cursor` is non-null (e.g.
 * 'crosshair' during an edit mode). Falls back to DEFAULT_CURSOR when no
 * overrides are active.
 */
export function useMapCursor(cursor: string | null): void {
  const interactions = useContext(MapInteractionsContext);

  useEffect(() => {
    if (!interactions || !cursor) {
      return undefined;
    }

    return interactions.registerCursor(cursor);
  }, [interactions, cursor]);
}

/**
 * Renders children as screen-anchored content on top of the map (inside the
 * map's relatively-positioned wrapper), for buttons and HUD overlays.
 * Children typically use absolute positioning.
 */
export function MapControl({ children }: { children: React.ReactNode }) {
  const host = useContext(MapControlHostContext);

  if (!host) {
    return null;
  }

  // Re-enable pointer events for the control content: some providers (e.g.
  // MapLibre) make the control host transparent to pointer events so the map
  // underneath stays draggable, which would otherwise leave buttons here
  // unclickable. The wrapper generates no box of its own (its children are
  // absolutely positioned), and controls that must not block the map — such
  // as the wind arrow — still opt out with their own `pointerEvents: 'none'`.
  return createPortal(
    <div style={{ pointerEvents: 'auto' }}>{children}</div>,
    host
  );
}
