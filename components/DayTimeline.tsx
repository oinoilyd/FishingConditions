'use client'

interface TimelineSlot {
  hour: number
  label: string
  score: number
  quality: string
}

interface DayTimelineProps {
  timeline: TimelineSlot[]
}

export default function DayTimeline({ timeline }: DayTimelineProps) {
  if (!timeline?.length) return null

  const now = new Date()
  const currentHour = now.getHours()

  return (
    <div className="mb-5">
      <p className="text-white/40 text-xs uppercase tracking-widest mb-2 px-5">Today&apos;s Windows</p>
      <div className="overflow-x-auto px-5 pb-1">
        <div className="flex gap-2 w-max">
          {timeline.map((slot, i) => {
            const isCurrent = slot.hour === currentHour
            const color =
              slot.score >= 8 ? 'bg-green-500' :
              slot.score >= 6 ? 'bg-green-400/70' :
              slot.score >= 4 ? 'bg-yellow-400/70' :
              'bg-red-400/60'
            const textColor =
              slot.score >= 8 ? 'text-green-300' :
              slot.score >= 6 ? 'text-green-400/80' :
              slot.score >= 4 ? 'text-yellow-300' :
              'text-red-300/80'
            const barHeight = Math.round((slot.score / 10) * 32)

            return (
              <div
                key={i}
                className={`flex flex-col items-center gap-1 min-w-[44px] rounded-xl py-2 px-1 transition-all ${
                  isCurrent ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5'
                }`}
              >
                <span className={`text-xs font-bold ${textColor}`}>{slot.score}</span>
                <div className="w-4 bg-white/10 rounded-full overflow-hidden" style={{ height: '32px' }}>
                  <div
                    className={`w-full rounded-full transition-all ${color}`}
                    style={{ height: `${barHeight}px`, marginTop: `${32 - barHeight}px` }}
                  />
                </div>
                <span className={`text-xs ${isCurrent ? 'text-white font-semibold' : 'text-white/40'}`}>
                  {isCurrent ? 'Now' : slot.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
