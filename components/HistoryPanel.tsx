'use client'
import { useEffect, useState } from 'react'
import { getHistory, clearHistory, timeAgo, type HistoryEntry } from '@/lib/history'

interface HistoryPanelProps {
  onSelect: (entry: HistoryEntry) => void
  onClose: () => void
}

export default function HistoryPanel({ onSelect, onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    setEntries(getHistory())
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClear = () => {
    clearHistory()
    setEntries([])
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-t-3xl border-t border-white/10 max-h-[80vh] flex flex-col animate-slide-up">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Pin History</h2>
            <p className="text-white/40 text-xs mt-0.5">Tap any location for an updated report</p>
          </div>
          <div className="flex items-center gap-3">
            {entries.length > 0 && (
              <button onClick={handleClear} className="text-white/30 hover:text-red-400 text-xs transition-colors">
                Clear all
              </button>
            )}
            <button onClick={onClose} className="text-white/40 hover:text-white text-3xl leading-none">×</button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto px-5 pb-10">
          {entries.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📍</p>
              <p className="text-white/40 text-sm">No pins yet</p>
              <p className="text-white/20 text-xs mt-1">Drop a pin and get a report to start your history</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(entry)}
                  className="w-full text-left bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 rounded-2xl px-4 py-3.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{entry.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                          {entry.speciesLabel}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white/30 text-xs">{timeAgo(entry.timestamp)}</p>
                      <p className="text-blue-400/60 text-xs mt-1">Tap to refresh →</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
