import L from 'leaflet';

// Leaflet 1.9.4 bug: an animated zoom (flyTo, fitBounds, zoom buttons) ends
// via setTimeout(_onZoomTransitionEnd, 250), which map.remove() doesn't cancel.
// If the map is removed mid-zoom (switching back to the list), the callback
// runs on a removed map and throws "Cannot read properties of undefined
// (reading '_leaflet_pos')". Skip it once the map's panes are gone.
const MapPrototype = L.Map.prototype as unknown as {
  _onZoomTransitionEnd: (this: { _mapPane?: HTMLElement }) => void;
};
const onZoomTransitionEnd = MapPrototype._onZoomTransitionEnd;
MapPrototype._onZoomTransitionEnd = function () {
  if (!this._mapPane) return;
  onZoomTransitionEnd.call(this);
};
