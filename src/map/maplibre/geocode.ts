/**
 * Key-free place search for the MapLibre provider.
 *
 * The Google adapter backs the Target "Search" box with Google Places, which
 * needs the Maps JS API. Under MapLibre there is no Google API loaded, so this
 * provides an equivalent autocomplete using Photon (https://photon.komoot.io),
 * a free, CORS-enabled, key-less geocoder that supports type-ahead. It matches
 * `attachPlaceAutocomplete`'s contract: attach to an input, call `onPlace`
 * with the chosen location's coordinates.
 *
 * Confined to `src/map/maplibre/`.
 */
import { LatLng } from '../../types';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const DEBOUNCE_MS = 250;
const MAX_RESULTS = 5;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

/** Human-readable one-line label for a Photon feature. */
function labelFor(f: PhotonFeature): string {
  const p = f.properties;
  const parts = [p.name ?? p.street, p.city, p.state, p.country].filter(Boolean);

  return parts.join(', ');
}

/**
 * Attach a Photon-backed autocomplete to a text input. As the user types, a
 * suggestion dropdown is shown beneath the input; picking one calls `onPlace`
 * with its coordinates. Safe to call once per input (idempotent-ish: it wires
 * listeners and owns a single dropdown element).
 */
export function attachPlaceAutocomplete(
  input: HTMLInputElement,
  onPlace: (pos: LatLng) => void
): void {
  const container = input.parentElement;

  if (!container) {
    return;
  }
  // The dropdown is positioned relative to the input's wrapper.
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  const menu = document.createElement('ul');

  Object.assign(menu.style, {
    position: 'absolute',
    top: '100%',
    left: '0',
    right: '0',
    zIndex: '1300',
    margin: '2px 0 0',
    padding: '0',
    listStyle: 'none',
    background: '#1e1e1e',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    maxHeight: '220px',
    overflowY: 'auto',
    display: 'none',
    fontSize: '13px'
  } as Partial<CSSStyleDeclaration>);
  container.appendChild(menu);

  let seq = 0;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const hide = () => {
    menu.style.display = 'none';
    menu.innerHTML = '';
  };

  const render = (features: PhotonFeature[]) => {
    menu.innerHTML = '';
    if (features.length === 0) {
      hide();

      return;
    }
    for (const f of features) {
      const item = document.createElement('li');

      item.textContent = labelFor(f);
      Object.assign(item.style, {
        padding: '6px 10px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      } as Partial<CSSStyleDeclaration>);
      item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.12)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      // mousedown (not click) so it fires before the input's blur hides the menu.
      item.addEventListener('mousedown', ev => {
        ev.preventDefault();
        const [lng, lat] = f.geometry.coordinates;

        input.value = labelFor(f);
        hide();
        onPlace({ lat, lng });
      });
      menu.appendChild(item);
    }
    menu.style.display = 'block';
  };

  const search = (query: string) => {
    const mySeq = ++seq;
    const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${MAX_RESULTS}`;

    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`Photon ${r.status}`))))
      .then((data: { features?: PhotonFeature[] }) => {
        if (mySeq !== seq) {
          return; // a newer query superseded this one
        }
        render((data.features ?? []).filter(f => f.geometry?.coordinates));
      })
      .catch(err => {
        console.log('Photon geocode failed:', err);
      });
  };

  input.addEventListener('input', () => {
    const query = input.value.trim();

    if (debounce) {
      clearTimeout(debounce);
    }
    if (query.length < 3) {
      hide();

      return;
    }
    debounce = setTimeout(() => search(query), DEBOUNCE_MS);
  });

  input.addEventListener('blur', () => {
    // Delay so a suggestion's mousedown can complete first.
    setTimeout(hide, 150);
  });
}
