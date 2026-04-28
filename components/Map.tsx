'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

interface MapProps {
  onLocationSelect: (lat: number, lng: number, name: string) => void
}

export default function Map({ onLocationSelect }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const callbackRef = useRef(onLocationSelect)

  useEffect(() => {
    callbackRef.current = onLocationSelect
  }, [onLocationSelect])

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

    map.current.on('click', async (e) => {
      const { lat, lng } = e.lngLat

      if (marker.current) marker.current.remove()
      marker.current = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([lng, lat])
        .addTo(map.current!)

      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
        )
        const data = await res.json()
        const name = data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        callbackRef.current(lat, lng, name)
      } catch {
        callbackRef.current(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white/80 text-xs px-3 py-1.5 rounded-full pointer-events-none">
        Tap anywhere on water to drop a pin
      </div>
    </div>
  )
}
