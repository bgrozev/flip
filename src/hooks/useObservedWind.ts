import { useCallback, useState } from 'react';

import { fetchObservedStations, nearestGroundWindStation } from '../forecast/observedWind';
import { LatLng, ObservedWindStation } from '../types';

interface UseObservedWindResult {
  stations: ObservedWindStation[];
  nearestStation: ObservedWindStation | null;
  stationsFetched: boolean;
  fetchingObserved: boolean;
  fetchObserved: (target: LatLng) => void;
  resetObserved: () => void;
}

export function useObservedWind(): UseObservedWindResult {
  const [stations, setStations] = useState<ObservedWindStation[]>([]);
  const [stationsFetched, setStationsFetched] = useState(false);
  const [fetchingObserved, setFetchingObserved] = useState(false);

  const fetchObserved = useCallback((target: LatLng) => {
    setFetchingObserved(true);
    fetchObservedStations(target)
      .then(result => {
        setStations(result);
        setStationsFetched(true);
      })
      .catch(err => {
        console.log(`Failed to fetch observed wind stations: ${err}`);
        setStationsFetched(true);
      })
      .finally(() => setFetchingObserved(false));
  }, []);

  const resetObserved = useCallback(() => {
    setStations([]);
    setStationsFetched(false);
  }, []);

  const nearestStation = nearestGroundWindStation(stations);

  return { stations, nearestStation, stationsFetched, fetchingObserved, fetchObserved, resetObserved };
}
