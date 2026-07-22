import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { itemsApi } from '../../api';
import ItemCard from './ItemCard';
import L from 'leaflet';

const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const CENTER = [-17.7833, 31.05];
const DEFAULT_ZOOM = 13;

function MapMoveHandler({ onMove }) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onMove({ lat: center.lat, lng: center.lng, zoom });
    },
  });
  return null;
}

function MapComponent({ items, selectedItem, onItemClick, center, zoom, onMapMove }) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map((item) => {
        // Handle both old format (item.location.coordinates) and new format (item.geometry.coordinates)
        const coords = item.geometry?.coordinates || item.location?.coordinates;
        if (!coords) return null;
        return (
          <Marker
            key={item.id || item.properties?.id}
            position={[coords[1], coords[0]]}
            eventHandlers={{ click: () => onItemClick(item) }}
          >
            <Popup>
              <div className="p-1 min-w-[200px]">
                <h4 className="font-medium text-gray-900 truncate">{item.properties?.title || item.title}</h4>
                <p className="text-sm text-gray-500">${item.properties?.daily_rate_usd || item.daily_rate_usd}/day</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemClick(item);
                  }}
                  className="mt-2 w-full text-xs bg-blue-600 text-white py-1 rounded hover:bg-blue-700"
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
      <MapMoveHandler onMove={onMapMove} />
    </MapContainer>
  );
}

function ItemList({ items, selectedItem, onItemClick, loading, widenSuggestion, onWidenSearch }) {
  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading items">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="mt-3 h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="mt-2 h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-900">No items found</h3>
        <p className="mt-1 text-gray-500">
          {widenSuggestion
            ? 'No items within 5km. Try widening your search radius.'
            : 'No items available in this area.'}
        </p>
        {widenSuggestion && (
          <button
            onClick={onWidenSearch}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Search within 10km instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" role="list" aria-label="Available items">
      {items.map((item) => (
        <ItemCard
          key={item.properties?.id || item.id}
          item={item.properties || item}
          distance={item.properties?.distance_km || item.distance_km}
          selected={selectedItem?.id === (item.properties?.id || item.id)}
          onClick={() => onItemClick(item)}
        />
      ))}
    </div>
  );
}

export default function ItemSearch({ initialLat, initialLng }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewMode, setViewMode] = useState('map');
  const [center, setCenter] = useState([initialLat || CENTER[0], initialLng || CENTER[1]]);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [radius, setRadius] = useState(5);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('distance');
  const [widenSuggestion, setWidenSuggestion] = useState(false);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    if (!center[0] || !center[1]) return;
    setLoading(true);
    setError(null);
    try {
      const response = await itemsApi.search({
        lat: center[0],
        lng: center[1],
        radius_km: radius,
        category: category || undefined,
        sort,
      });
      console.log('Search API response:', response.data);
      const features = response.data.features || [];
      console.log('Features count:', features.length);
      setItems(features);
      setWidenSuggestion(response.data.widen_suggestion || false);
    } catch (err) {
      setError('Failed to load items. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [center, radius, category, sort]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    itemsApi.categories().then(res => setCategories(res.data));
  }, []);

  const handleMapMove = ({ lat, lng, zoom: newZoom }) => {
    setCenter([lat, lng]);
    setZoom(newZoom);
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    if (viewMode === 'map') {
      setViewMode('list');
    }
  };

  const handleWidenSearch = () => {
    setRadius(10);
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Radius:</label>
          <select
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={1}>1 km</option>
            <option value={2}>2 km</option>
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Category:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm font-medium text-gray-700">Sort:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="distance">Distance</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2 border-l border-gray-300 pl-4 ml-4">
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              viewMode === 'map' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchItems} className="text-red-600 hover:underline">Retry</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'map' ? (
          <>
            <div className="w-3/4 h-full relative">
              <MapComponent
                items={items}
                selectedItem={selectedItem}
                onItemClick={handleItemClick}
                center={center}
                zoom={zoom}
                onMapMove={handleMapMove}
              />
              {selectedItem && (
                <div className="absolute bottom-4 right-4 left-4 md:left-auto md:right-4 md:w-80 bg-white rounded-xl shadow-lg border p-4 z-10">
                  <ItemCard
                    item={selectedItem.properties}
                    distance={selectedItem.properties.distance_km}
                    onClose={() => setSelectedItem(null)}
                  />
                </div>
              )}
            </div>
            <div className="w-1/4 h-full border-l border-gray-200 overflow-y-auto">
              <ItemList
                items={items}
                selectedItem={selectedItem}
                onItemClick={handleItemClick}
                loading={loading}
                widenSuggestion={widenSuggestion}
                onWidenSearch={handleWidenSearch}
              />
            </div>
          </>
        ) : (
          <div className="w-full h-full overflow-y-auto p-4">
            <ItemList
              items={items}
              selectedItem={selectedItem}
              onItemClick={handleItemClick}
              loading={loading}
              widenSuggestion={widenSuggestion}
              onWidenSearch={handleWidenSearch}
            />
          </div>
        )}
      </div>
    </div>
  );
}