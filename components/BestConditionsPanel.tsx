'use client'
import { useEffect } from 'react'

interface BestSpot {
  lat: number
  lng: number
  score: number
}

interface BestConditionsPanelProps {
  spots: BestSpot[]
  loading: boolean
  onSelect: (spot: BestSpot) => void
  onClose: () => void
}

export default function BestConditionsPanel({ spots, loading, onSelect, onClose }: BestConditionsPanelProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const highScoring = [...spots].filter(s => s.score >= 7.5).sort((a, b) => b.score - a.score)
  const others = [...spots].filter(s => s.score < 7.5).sort((a, b) => b.score - a.score)

  const ScoreBar = ({ score }: { score: number }) => {
    const color = score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-green-400/70' : score >= 4 ? 'bg-yellow-400' : 'bg-red-400'
    return (
      <div className="flex items-center gap-2 flex-1">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${score * 10}%` }} />
        </div>
        <span className={`text-sm font-bold w-6 text-right ${score >= 8 ? 'text-green-400' : score >= 6 ? 'text-green-400/80' : score >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
          {score}
        </span>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-t-3xl border-t border-white/10 max-h-[70vh] flex flex-col animate-slide-up">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="px-5 pt-3 pb-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">🌿 Best Conditions</h2>
            <p className="text-white/40 text-xs mt-0.5">Scored across current map view</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-3xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto px-5 pb-10">
          {loading ? (
            <div className="py-10 text-center">
              <p className="text-white/40 animate-pulse text-sm">Scanning conditions across the map...</p>
            </div>
          ) : spots.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-white/40 text-sm">No data yet — tap Best Conditions on the map first</p>
            </div>
          ) : (
            <>
              {highScoring.length > 0 && (
                <>
                  <p className="text-green-400/70 text-xs uppercase tracking-widest mb-3">🟢 High scoring areas (7.5+)</p>
                  <div className="space-y-2 mb-5">
                    {highScoring.map((spot, i) => (
                      <button
                        key={i}
                        onClick={() => onSelect(spot)}
                        className="w-full text-left bg-green-500/10 hover:bg-green-500/20 active:scale-[0.98] border border-green-500/20 rounded-2xl px-4 py-3 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-white/70 text-xs">
                              {spot.lat.toFixed(3)}°N, {Math.abs(spot.lng).toFixed(3)}°W
                            </p>
                          </div>
                          <ScoreBar score={spot.score} />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {others.length > 0 && (
                <>
                  <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Other areas</p>
                  <div className="space-y-2">
                    {others.map((spot, i) => (
                      <button
                        key={i}
                        onClick={() => onSelect(spot)}
                        className="w-full text-left bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 rounded-2xl px-4 py-3 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-white/50 text-xs">
                              {spot.lat.toFixed(3)}°N, {Math.abs(spot.lng).toFixed(3)}°W
                            </p>
                          </div>
                          <ScoreBar score={spot.score} />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
