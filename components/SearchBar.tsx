'use client'
import { useState, useRef } from 'react'

interface Suggestion {
  id: string
  place_name: string
  center: [number, number]
}

interface SearchBarProps {
  onLocationSelect: (lat: number, lng: number, name: string) => void
}

export default function SearchBar({ onLocationSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = async (value: string) => {
    if (value.length < 3) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&country=US&types=place,locality,neighborhood,poi,region`
      )
      const data = await res.json()
      setSuggestions(data.features || [])
    } catch {
      setSuggestions([])
    }
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  const handleSelect = (suggestion: Suggestion) => {
    const [lng, lat] = suggestion.center
    setQuery(suggestion.place_name)
    setSuggestions([])
    onLocationSelect(lat, lng, suggestion.place_name)
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search a lake, river, or fishing spot..."
          className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-blue-400 text-sm"
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">
            ...
          </span>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1.5 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {suggestions.slice(0, 6).map((s) => (
            <li
              key={s.id}
              onClick={() => handleSelect(s)}
              className="px-4 py-3 text-white/90 hover:bg-white/10 cursor-pointer text-sm border-b border-white/5 last:border-0 transition-colors"
            >
              <span className="mr-2 text-white/40">📍</span>
              {s.place_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
