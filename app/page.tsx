'use client'
import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import SearchBar from '@/components/SearchBar'
import ReportPanel from '@/components/ReportPanel'
import LoadingReport from '@/components/LoadingReport'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

const SPECIES = [
  { value: 'general', label: 'All Species (General)' },
  { value: 'largemouth-bass', label: 'Largemouth Bass' },
  { value: 'smallmouth-bass', label: 'Smallmouth Bass' },
  { value: 'walleye', label: 'Walleye' },
  { value: 'pike', label: 'Northern Pike / Muskie' },
  { value: 'trout', label: 'Trout (Brown / Rainbow)' },
  { value: 'salmon', label: 'Salmon' },
  { value: 'catfish', label: 'Catfish' },
  { value: 'panfish', label: 'Panfish / Crappie / Bluegill' },
]

interface Location {
  lat: number
  lng: number
  name: string
}

interface CacheEntry {
  report: unknown
  timestamp: number
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'search' | 'map'>('map')
  const [location, setLocation] = useState<Location | null>(null)
  const [species, setSpecies] = useState('general')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Record<string, CacheEntry>>({})

  const handleLocationSelect = useCallback((lat: number, lng: number, name: string) => {
    setLocation({ lat, lng, name })
    setReport(null)
    setError(null)
  }, [])

  const fetchReport = async (targetSpecies: string) => {
    if (!location) return

    const cacheKey = `${location.lat.toFixed(2)},${location.lng.toFixed(2)},${targetSpecies}`
    const cached = cacheRef.current[cacheKey]
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      setReport(cached.report as never)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          locationName: location.name,
          species: targetSpecies,
          localTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          localDate: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      cacheRef.current[cacheKey] = { report: data, timestamp: Date.now() }
      setReport(data)
    } catch {
      setError('Failed to generate report. Please try again.')
    }

    setLoading(false)
  }

  const handleGetReport = () => fetchReport(species)

  const handleSpeciesChangeFromPanel = (newSpecies: string) => {
    setSpecies(newSpecies)
    setReport(null)
    fetchReport(newSpecies)
  }

  const selectedSpeciesLabel = SPECIES.find(s => s.value === species)?.label || 'All Species'

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🎣</span>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">CastIQ</h1>
            <p className="text-white/40 text-xs">Hyperlocal fishing intelligence</p>
          </div>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="px-5 mt-6 mb-5">
        <div className="flex bg-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'map'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Drop a Pin
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'search'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Search Location
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 flex-1">
        {activeTab === 'search' ? (
          <div>
            <SearchBar onLocationSelect={handleLocationSelect} />
            <p className="text-white/30 text-xs mt-3 text-center">
              Try "Lake Michigan Chicago" or "Elk River Montana"
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-white/10" style={{ height: '420px' }}>
            <Map onLocationSelect={handleLocationSelect} />
          </div>
        )}

        {/* Species Selector */}
        <div className="mt-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Target Species</p>
          <div className="relative">
            <select
              value={species}
              onChange={e => { setSpecies(e.target.value); setReport(null) }}
              className="w-full appearance-none bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
            >
              {SPECIES.map(s => (
                <option key={s.value} value={s.value} className="bg-slate-800 text-white">
                  {s.label}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">▾</span>
          </div>
        </div>

        {location && loading && (
          <div className="mt-5">
            <LoadingReport />
          </div>
        )}
      </div>

      <div className="h-32" />

      {/* Floating bottom bar — appears when location is selected */}
      {location && !loading && !report && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-5 pb-8 pt-4 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent">
          <div className="mb-2 bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-0.5">Selected Location</p>
            <p className="text-white font-medium text-sm truncate">{location.name}</p>
            <p className="text-white/30 text-xs mt-0.5">{selectedSpeciesLabel}</p>
          </div>
          {error && <p className="text-red-400 text-sm mb-2 text-center">{error}</p>}
          <button
            onClick={handleGetReport}
            className="w-full py-4 bg-blue-500 hover:bg-blue-400 active:scale-95 rounded-2xl font-semibold text-white text-base transition-all shadow-lg shadow-blue-500/30"
          >
            Get Fishing Report
          </button>
        </div>
      )}

      {report && (
        <ReportPanel
          report={report}
          onClose={() => setReport(null)}
          onSpeciesChange={handleSpeciesChangeFromPanel}
        />
      )}
    </main>
  )
}
