'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { type HistoryEntry } from '@/lib/history'

interface BestSpot { lat: number; lng: number; score: number }

interface MapProps {
  onLocationSelect: (lat: number, lng: number, name: string) => void
  historyPins?: HistoryEntry[]
  onHistoryPinSelect?: (entry: HistoryEntry) => void
  bestSpots?: BestSpot[]
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void
}

export default function Map({ onLocationSelect, historyPins, onHistoryPinSelect, bestSpots, onBoundsChange }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const historyMarkersRef = useRef<mapboxgl.Marker[]>([])
  const callbackRef = useRef(onLocationSelect)
  const historyCallbackRef = useRef(onHistoryPinSelect)
  const boundsCallbackRef = useRef(onBoundsChange)

  useEffect(() => { callbackRef.current = onLocationSelect }, [onLocationSelect])
  useEffect(() => { historyCallbackRef.current = onHistoryPinSelect }, [onHistoryPinSelect])
  useEffect(() => { boundsCallbackRef.current = onBoundsChange }, [onBoundsChange])

  // Main map init
  useEffect(() => {
    if (!mapContainer.current || map.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-95.7129, 37.0902],
      zoom: 4,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const emitBounds = () => {
      if (!map.current) return
      const b = map.current.getBounds()
      if (!b) return
      boundsCallbackRef.current?.({
        north: b.getNorth(), south: b.getSouth(),
        east: b.getEast(), west: b.getWest(),
      })
    }

    map.current.on('load', emitBounds)
    map.current.on('moveend', emitBounds)

    map.current.on('click', async (e) => {
      const { lat, lng } = e.lngLat
      if (marker.current) marker.current.remove()
      marker.current = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([lng, lat])
        .addTo(map.current!)

      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=poi,place,locality,region,district`
        )
        const data = await res.json()
        const features = data.features || []
        const waterPattern = /\b(lake|river|creek|bay|pond|reservoir|ocean|sea|gulf|sound|strait|stream|brook|channel|harbor|harbour|inlet|cove|marsh|slough)\b/i
        // Prefer POI features that are actual water bodies — this catches "Lake Michigan"
        // before "Lake Bluff" (a city that contains the word "lake")
        const settlementTypes = ['locality', 'place', 'neighborhood', 'district', 'postcode', 'address']
        const waterFeature =
          features.find((f: { text?: string; place_type?: string[] }) =>
            waterPattern.test(f.text || '') &&
            f.place_type?.includes('poi') &&
            !f.place_type?.some((t: string) => settlementTypes.includes(t))
          ) ||
          features.find((f: { text?: string; place_type?: string[] }) =>
            waterPattern.test(f.text || '') &&
            !f.place_type?.some((t: string) => settlementTypes.includes(t))
          ) ||
          features.find((f: { text?: string }) => waterPattern.test(f.text || ''))
        let name: string
        if (waterFeature) {
          const region = features.find((f: { place_type?: string[] }) => f.place_type?.includes('region'))
          name = region ? `${waterFeature.text}, ${region.text}` : waterFeature.text
        } else {
          name = features[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        }
        callbackRef.current(lat, lng, name)
      } catch {
        callbackRef.current(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
    })

    return () => { map.current?.remove(); map.current = null }
  }, [])

  // History pins
  useEffect(() => {
    historyMarkersRef.current.forEach(m => m.remove())
    historyMarkersRef.current = []
    if (!map.current || !historyPins?.length) return

    historyPins.forEach(entry => {
      const el = document.createElement('div')
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg); background: #f59e0b;
        border: 2px solid #fff; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      `
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        historyCallbackRef.current?.(entry)
      })
      const m = new mapboxgl.Marker({ element: el, anchor: 'bottom-left' })
        .setLngLat([entry.lng, entry.lat])
        .addTo(map.current!)
      historyMarkersRef.current.push(m)
    })
  }, [historyPins])

  // Best conditions overlay
  useEffect(() => {
    if (!map.current) return
    const mapInst = map.current

    const addOverlay = () => {
      // Remove old layers/sources
      if (mapInst.getLayer('best-conditions-glow')) mapInst.removeLayer('best-conditions-glow')
      if (mapInst.getLayer('best-conditions-core')) mapInst.removeLayer('best-conditions-core')
      if (mapInst.getSource('best-conditions')) mapInst.removeSource('best-conditions')

      if (!bestSpots?.length) return

      const highScoring = bestSpots.filter(s => s.score >= 7.5)
      if (!highScoring.length) return

      mapInst.addSource('best-conditions', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: highScoring.map(s => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
            properties: { score: s.score },
          })),
        },
      })

      mapInst.addLayer({
        id: 'best-conditions-glow',
        type: 'circle',
        source: 'best-conditions',
        paint: {
          'circle-radius': 60,
          'circle-color': '#22c55e',
          'circle-opacity': 0.15,
          'circle-blur': 1,
        },
      }, 'waterway-label')

      mapInst.addLayer({
        id: 'best-conditions-core',
        type: 'circle',
        source: 'best-conditions',
        paint: {
          'circle-radius': 25,
          'circle-color': '#22c55e',
          'circle-opacity': 0.25,
          'circle-blur': 0.5,
        },
      }, 'waterway-label')
    }

    if (mapInst.isStyleLoaded()) {
      addOverlay()
    } else {
      mapInst.once('load', addOverlay)
    }
  }, [bestSpots])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white/80 text-xs px-3 py-1.5 rounded-full pointer-events-none">
        Tap anywhere on water to drop a pin
      </div>
    </div>
  )
}
