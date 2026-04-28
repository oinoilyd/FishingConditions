export interface HistoryEntry {
  lat: number
  lng: number
  name: string
  species: string
  speciesLabel: string
  timestamp: number
}

const KEY = 'castiq_history'
const MAX = 30

export function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function addToHistory(entry: Omit<HistoryEntry, 'timestamp'>) {
  const history = getHistory()
  const filtered = history.filter(h =>
    !(Math.abs(h.lat - entry.lat) < 0.005 && Math.abs(h.lng - entry.lng) < 0.005 && h.species === entry.species)
  )
  filtered.unshift({ ...entry, timestamp: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)))
}

export function clearHistory() {
  localStorage.removeItem(KEY)
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
