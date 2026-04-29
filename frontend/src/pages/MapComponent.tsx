import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type SiteRow = {
  site: {
    id: number
    name: string
    latitude?: number
    longitude?: number
    location?: string
    device_type?: string
  }
  health: 'healthy' | 'warning' | 'critical'
  currentPower: number
  region: string
  cluster: string
}

type MapComponentProps = {
  siteRows: SiteRow[]
  onSiteClick: (siteId: number) => void
  selectedSiteId: number | null
}

type LayerVisibility = {
  weather: boolean
  heatmap: boolean
  clusters: boolean
  points: boolean
}

type WeatherLayerKind = 'precipitation' | 'clouds' | 'temp'

type SiteFeatureProperties = {
  siteId: number
  name: string
  health: 'healthy' | 'warning' | 'critical'
  power: number
  region: string
  cluster: string
  healthWeight: number
}

const SOURCE_ID = 'sites-source'
const WEATHER_SOURCE_ID = 'weather-overlay-source'
const WEATHER_LAYER_ID = 'weather-overlay-layer'
const HEAT_LAYER_ID = 'sites-heat-layer'
const CLUSTER_LAYER_ID = 'sites-cluster-layer'
const CLUSTER_COUNT_LAYER_ID = 'sites-cluster-count-layer'
const POINT_LAYER_ID = 'sites-point-layer'

const WEATHER_TILE_URL = (import.meta.env.VITE_WEATHER_TILE_URL as string | undefined)?.trim() || ''
const HAS_WEATHER_TILE = Boolean(WEATHER_TILE_URL)
const WEATHER_LAYER_KIND = ((import.meta.env.VITE_WEATHER_LAYER_KIND as string | undefined)?.trim()?.toLowerCase() || 'precipitation') as WeatherLayerKind
const DEFAULT_WEATHER_OPACITY = 0.38

const WEATHER_META: Record<WeatherLayerKind, { title: string; unit: string; gradient: string; marks: [string, string, string] }> = {
  precipitation: {
    title: 'Mưa (Precipitation)',
    unit: 'mm/h',
    gradient: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 40%, #22d3ee 100%)',
    marks: ['0', '8', '20+'],
  },
  clouds: {
    title: 'Mây (Cloud Cover)',
    unit: '%',
    gradient: 'linear-gradient(90deg, #0f172a 0%, #64748b 50%, #e2e8f0 100%)',
    marks: ['0', '50', '100'],
  },
  temp: {
    title: 'Nhiệt độ bề mặt',
    unit: '°C',
    gradient: 'linear-gradient(90deg, #1d4ed8 0%, #22d3ee 35%, #f59e0b 70%, #ef4444 100%)',
    marks: ['<10', '25', '40+'],
  },
}

function normalizeWeatherKind(value: string): WeatherLayerKind {
  if (value === 'clouds' || value === 'temp' || value === 'precipitation') return value
  return 'precipitation'
}

function formatMetric(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function healthWeight(health: SiteRow['health']) {
  if (health === 'critical') return 1
  if (health === 'warning') return 0.7
  return 0.4
}

function buildFeatureCollection(rows: SiteRow[]): GeoJSON.FeatureCollection<GeoJSON.Point, SiteFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter((r) => r.site.latitude !== undefined && r.site.longitude !== undefined)
      .map((row) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [row.site.longitude!, row.site.latitude!],
        },
        properties: {
          siteId: row.site.id,
          name: row.site.name,
          health: row.health,
          power: row.currentPower,
          region: row.region,
          cluster: row.cluster,
          healthWeight: healthWeight(row.health),
        },
      })),
  }
}

export default function MapComponent({ siteRows, onSiteClick, selectedSiteId }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    weather: HAS_WEATHER_TILE,
    heatmap: true,
    clusters: true,
    points: true,
  })
  const [weatherOpacity, setWeatherOpacity] = useState(DEFAULT_WEATHER_OPACITY)

  const weatherKind = normalizeWeatherKind(WEATHER_LAYER_KIND)
  const weatherMeta = WEATHER_META[weatherKind]

  const featureCollection = useMemo(() => buildFeatureCollection(siteRows), [siteRows])

  const toggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setLayerVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }, [])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CARTO',
          },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#0a0f1a' } },
          { id: 'carto-tiles', type: 'raster', source: 'carto-dark' },
        ],
      },
      center: [108.2, 15.5],
      zoom: 5.5,
      minZoom: 4,
      maxZoom: 18,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.on('load', () => {
      if (HAS_WEATHER_TILE) {
        map.addSource(WEATHER_SOURCE_ID, {
          type: 'raster',
          tiles: [WEATHER_TILE_URL],
          tileSize: 256,
          attribution: 'Weather overlay',
        })

        map.addLayer({
          id: WEATHER_LAYER_ID,
          type: 'raster',
          source: WEATHER_SOURCE_ID,
          layout: { visibility: layerVisibility.weather ? 'visible' : 'none' },
          paint: {
            'raster-opacity': weatherOpacity,
            'raster-resampling': 'linear',
          },
        })
      }

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: featureCollection,
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 10,
      })

      map.addLayer({
        id: HEAT_LAYER_ID,
        type: 'heatmap',
        source: SOURCE_ID,
        maxzoom: 9,
        layout: { visibility: layerVisibility.heatmap ? 'visible' : 'none' },
        paint: {
          'heatmap-weight': ['get', 'healthWeight'],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            0.6,
            9,
            1.3,
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            14,
            9,
            36,
          ],
          'heatmap-opacity': 0.55,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(59,130,246,0)',
            0.2,
            'rgba(56,189,248,0.35)',
            0.45,
            'rgba(251,191,36,0.45)',
            0.75,
            'rgba(251,146,60,0.65)',
            1,
            'rgba(244,63,94,0.75)',
          ],
        },
      })

      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { visibility: layerVisibility.clusters ? 'visible' : 'none' },
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#0ea5e9',
            8,
            '#06b6d4',
            20,
            '#22c55e',
            40,
            '#f59e0b',
            70,
            '#f43f5e',
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            16,
            8,
            20,
            20,
            24,
            40,
            30,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0f172a',
          'circle-opacity': 0.9,
        },
      })

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#e2e8f0',
        },
      })

      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: { visibility: layerVisibility.points ? 'visible' : 'none' },
        paint: {
          'circle-color': [
            'match',
            ['get', 'health'],
            'healthy',
            '#22c55e',
            'warning',
            '#f59e0b',
            'critical',
            '#f43f5e',
            '#38bdf8',
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'power'], 0],
            0,
            6,
            1000,
            8,
            5000,
            11,
            12000,
            14,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0f172a',
          'circle-opacity': 0.95,
        },
      })

      map.on('click', CLUSTER_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        const clusterId = feature?.properties?.cluster_id
        if (clusterId === undefined || clusterId === null) return

        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource & {
          getClusterExpansionZoom?: (clusterId: number, callback: (error: Error | null, zoom: number) => void) => void
        }

        if (!source.getClusterExpansionZoom) return

        source.getClusterExpansionZoom(Number(clusterId), (error, zoom) => {
          if (error || !event.lngLat) return
          map.easeTo({
            center: event.lngLat,
            zoom,
            duration: 600,
          })
        })
      })

      map.on('click', POINT_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        const props = feature?.properties as SiteFeatureProperties | undefined
        if (!feature || !props) return

        onSiteClick(Number(props.siteId))

        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
        }

        popupRef.current
          .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(buildPopupHTML(props))
          .addTo(map)
      })

      map.on('mouseenter', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('mouseenter', POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })

      setMapLoaded(true)
    })

    mapRef.current = map

    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [featureCollection, onSiteClick])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    source.setData(featureCollection)

    const coords = featureCollection.features.map((feature) => feature.geometry.coordinates as [number, number])

    if (coords.length > 1) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0]),
      )
      map.fitBounds(bounds, { padding: 56, maxZoom: 10, duration: 550 })
    } else if (coords.length === 1) {
      map.easeTo({ center: coords[0], zoom: 8.5, duration: 550 })
    }
  }, [featureCollection, mapLoaded])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current

    if (selectedSiteId === null) {
      map.setPaintProperty(POINT_LAYER_ID, 'circle-stroke-width', 1.5)
      map.setPaintProperty(POINT_LAYER_ID, 'circle-stroke-color', '#0f172a')
      return
    }

    map.setPaintProperty(POINT_LAYER_ID, 'circle-stroke-width', [
      'case',
      ['==', ['get', 'siteId'], selectedSiteId],
      3,
      1.5,
    ])
    map.setPaintProperty(POINT_LAYER_ID, 'circle-stroke-color', [
      'case',
      ['==', ['get', 'siteId'], selectedSiteId],
      '#67e8f9',
      '#0f172a',
    ])
  }, [selectedSiteId, mapLoaded])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current

    if (map.getLayer(WEATHER_LAYER_ID)) {
      map.setLayoutProperty(WEATHER_LAYER_ID, 'visibility', layerVisibility.weather ? 'visible' : 'none')
    }
    if (map.getLayer(HEAT_LAYER_ID)) {
      map.setLayoutProperty(HEAT_LAYER_ID, 'visibility', layerVisibility.heatmap ? 'visible' : 'none')
    }
    if (map.getLayer(CLUSTER_LAYER_ID)) {
      map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', layerVisibility.clusters ? 'visible' : 'none')
    }
    if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
      map.setLayoutProperty(CLUSTER_COUNT_LAYER_ID, 'visibility', layerVisibility.clusters ? 'visible' : 'none')
    }
    if (map.getLayer(POINT_LAYER_ID)) {
      map.setLayoutProperty(POINT_LAYER_ID, 'visibility', layerVisibility.points ? 'visible' : 'none')
    }
    if (map.getLayer(WEATHER_LAYER_ID)) {
      map.setPaintProperty(WEATHER_LAYER_ID, 'raster-opacity', weatherOpacity)
    }
  }, [layerVisibility, weatherOpacity, mapLoaded])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.25rem]">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Layer Controls */}
      <div className="absolute left-1 sm:left-3 top-1 sm:top-3 z-10 flex flex-col gap-1 sm:gap-2 max-w-[65vw] sm:max-w-none">
        <div className="rounded-xl border border-white/10 bg-slate-900/90 p-2.5 sm:p-3 backdrop-blur-sm">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Lớp hiển thị</div>
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-col">
            {HAS_WEATHER_TILE ? (
              <LayerToggle
                label={`Weather · ${weatherMeta.title}`}
                checked={layerVisibility.weather}
                onChange={() => toggleLayer('weather')}
                color="#60a5fa"
              />
            ) : null}
            <LayerToggle
              label="Heatmap"
              checked={layerVisibility.heatmap}
              onChange={() => toggleLayer('heatmap')}
              color="#38bdf8"
            />
            <LayerToggle
              label="Clusters"
              checked={layerVisibility.clusters}
              onChange={() => toggleLayer('clusters')}
              color="#22c55e"
            />
            <LayerToggle
              label="Sites"
              checked={layerVisibility.points}
              onChange={() => toggleLayer('points')}
              color="#f59e0b"
            />
          </div>
        </div>

        {!HAS_WEATHER_TILE ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-[11px] text-amber-200">
            Thiếu VITE_WEATHER_TILE_URL nên weather overlay đang tắt.
          </div>
        ) : (
          <div className="rounded-xl border border-cyan-400/20 bg-slate-900/90 p-2.5 sm:p-3 backdrop-blur-sm">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Weather overlay</div>
            <div className="mt-1 text-xs text-slate-200">{weatherMeta.title} ({weatherMeta.unit})</div>

            <div className="mt-2 h-2 rounded-full" style={{ background: weatherMeta.gradient }} />
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>{weatherMeta.marks[0]}</span>
              <span>{weatherMeta.marks[1]}</span>
              <span>{weatherMeta.marks[2]}</span>
            </div>

            <label className="mt-3 block text-[10px] uppercase tracking-wider text-slate-400">Opacity</label>
            <input
              type="range"
              min={0.15}
              max={0.85}
              step={0.05}
              value={weatherOpacity}
              onChange={(event) => setWeatherOpacity(Number(event.target.value))}
              className="mt-1 w-full accent-cyan-400"
            />
            <div className="mt-1 text-right text-[10px] text-slate-500">
              {Math.round(weatherOpacity * 100)}%
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="hidden sm:block rounded-xl border border-white/10 bg-slate-900/90 p-3 backdrop-blur-sm">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Trạng thái</div>
          <div className="flex flex-col gap-1.5">
            <LegendItem color="#22c55e" label="Vận hành tốt" />
            <LegendItem color="#f59e0b" label="Cần theo dõi" />
            <LegendItem color="#f43f5e" label="Cần xử lý" />
          </div>
        </div>
      </div>

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            Đang tải bản đồ...
          </div>
        </div>
      )}
    </div>
  )
}

function LayerToggle({
  label,
  checked,
  onChange,
  color,
}: {
  label: string
  checked: boolean
  onChange: () => void
  color: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-white/5"
    >
      <div
        className={`h-4 w-4 rounded border-2 transition ${
          checked ? 'border-transparent' : 'border-slate-600'
        }`}
        style={{ backgroundColor: checked ? color : 'transparent' }}
      />
      <span className={checked ? 'text-slate-200' : 'text-slate-500'}>{label}</span>
    </button>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-slate-300">{label}</span>
    </div>
  )
}

function buildPopupHTML(props: SiteFeatureProperties) {
  const healthLabel = { healthy: 'Vận hành tốt', warning: 'Cần theo dõi', critical: 'Cần xử lý' }[props.health]
  const healthColor = { healthy: '#22c55e', warning: '#f59e0b', critical: '#f43f5e' }[props.health]

  return `
    <div style="
      background: #0f172a;
      border: 1px solid ${healthColor}66;
      border-radius: 14px;
      padding: 12px 14px;
      font-family: inherit;
      color: #e2e8f0;
      min-width: 210px;
      box-shadow: 0 12px 28px rgba(2, 6, 23, 0.55);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <strong style="font-size:14px;color:white;">${props.name}</strong>
        <span style="
          font-size:10px;
          padding:2px 8px;
          border-radius:999px;
          border:1px solid ${healthColor}55;
          color:${healthColor};
          background:${healthColor}1a;
        ">${healthLabel}</span>
      </div>
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:#1e293b;border-radius:8px;padding:7px 8px;">
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Công suất</div>
          <div style="font-weight:600;color:#22d3ee;">${formatMetric(props.power)} W</div>
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:7px 8px;">
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Khu vực</div>
          <div style="font-weight:600;">${props.region}</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px;color:#94a3b8;">${props.cluster}</div>
    </div>
  `
}
