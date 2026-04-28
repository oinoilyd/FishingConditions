'use client'
import { useState, useEffect } from 'react'
import GlossaryText from '@/components/GlossaryText'
import LoadingReport from '@/components/LoadingReport'
import DayTimeline from '@/components/DayTimeline'

const SPECIES = [
  { value: 'general', label: 'General' },
  { value: 'largemouth-bass', label: 'L. Bass' },
  { value: 'smallmouth-bass', label: 'S. Bass' },
  { value: 'walleye', label: 'Walleye' },
  { value: 'pike', label: 'Pike / Muskie' },
  { value: 'trout', label: 'Trout' },
  { value: 'salmon', label: 'Salmon' },
  { value: 'catfish', label: 'Catfish' },
  { value: 'panfish', label: 'Panfish' },
]

interface Conditions {
  temperature: string
  wind: string
  pressure: string
  cloudCover: string
  weatherCondition: string
  waterTemp?: string
  waterTempSource?: 'sensor' | 'model'
}

interface TimelineSlot {
  hour: number
  label: string
  score: number
  quality: string
}

interface SensorReading {
  source: string
  stationName: string
  distanceMiles: number
  url?: string
  waterTemp?: string
  waveHeight?: string
  wavePeriod?: string
  waterLevel?: string
  flowRate?: string
  gaugeHeight?: string
  currentStage?: string
  actionStage?: string
  floodStage?: string
  moderateFloodStage?: string
  majorFloodStage?: string
  riverStatus?: string
  forecastStage?: string
  forecastTrend?: string
  windSpeed?: string
  windDirection?: string
  alerts?: string[]
}

interface Report {
  score: number
  locationName: string
  species: string
  summary: string
  conditionsInterpretation: string
  tacticalRecommendation: string
  depthRange: string
  baitProfile: string
  baitAlternatives?: string[]
  retrievalStyle: string
  structureTypes: string
  riskFlags: string[]
  conditions: Conditions
  sensorData?: SensorReading[] | null
  dayTimeline?: TimelineSlot[]
}

interface ReportPanelProps {
  report: Report | null
  loading?: boolean
  onClose: () => void
  onSpeciesChange: (species: string) => void
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 7 ? 'text-green-400' : score >= 4 ? 'text-yellow-400' : 'text-red-400'
  const bg = score >= 7 ? 'bg-green-500/10' : score >= 4 ? 'bg-yellow-500/10' : 'bg-red-500/10'
  const label = score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Fair' : 'Poor'
  return (
    <div className={`flex flex-col items-center min-w-[72px] rounded-2xl py-3 px-2 ${bg}`}>
      <div className={`text-5xl font-bold ${color}`}>{score}</div>
      <div className="text-white/40 text-xs mt-0.5">/10</div>
      <div className={`text-xs font-semibold mt-1 ${color}`}>{label}</div>
    </div>
  )
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="mb-5">
      <p className="text-white/40 text-xs uppercase tracking-widest mb-1.5">{title}</p>
      <p className="text-white/90 text-sm leading-relaxed">
        <GlossaryText text={content} />
      </p>
    </div>
  )
}

function BaitCard({ baitProfile, baitAlternatives }: { baitProfile: string; baitAlternatives?: string[] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <p className="text-white/40 text-xs mb-1">Bait Profile</p>
      <p className="text-white/90 text-sm"><GlossaryText text={baitProfile} /></p>
      {baitAlternatives && baitAlternatives.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-2 text-blue-400/80 text-xs hover:text-blue-300 transition-colors"
          >
            {expanded ? '▲ Less' : `▼ ${baitAlternatives.length} more options`}
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1">
              {baitAlternatives.map((alt, i) => (
                <li key={i} className="text-white/60 text-xs flex items-start gap-1.5">
                  <span className="text-white/20 mt-0.5">•</span>
                  <GlossaryText text={alt} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function ReportPanel({ report, loading, onClose, onSpeciesChange }: ReportPanelProps) {
  const [activeSpecies, setActiveSpecies] = useState(report?.species || 'general')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (report?.species) setActiveSpecies(report.species)
  }, [report?.species])

  const handleSpeciesChange = (value: string) => {
    setActiveSpecies(value)
    onSpeciesChange(value)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-t-3xl border-t border-white/10 max-h-[88vh] overflow-y-auto animate-slide-up">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Fishing Report</h2>
            <p className="text-white/40 text-xs mt-0.5 max-w-[260px] truncate">{report?.locationName}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-3xl leading-none mt-0.5">×</button>
        </div>

        {/* Species Switcher */}
        <div className="px-5 mb-4">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Switch Species</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SPECIES.map(s => (
              <button
                key={s.value}
                onClick={() => handleSpeciesChange(s.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeSpecies === s.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="px-5 pb-10">
            <LoadingReport />
          </div>
        ) : report && (
          <>
            {/* Score + Conditions */}
            <div className="mx-5 mb-5 bg-white/5 rounded-2xl p-4 border border-white/10 flex items-stretch gap-4">
              <ScoreRing score={report.score} />
              <div className="flex-1 border-l border-white/10 pl-4 space-y-2 justify-center flex flex-col">
                <div className="flex items-start gap-2 text-xs text-white/60">
                  <span>🌡</span><span>{report.conditions.temperature}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/60">
                  <span>💨</span><span>{report.conditions.wind}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/60">
                  <span>📊</span><span><GlossaryText text={report.conditions.pressure} /></span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/60">
                  <span>☁️</span><span>{report.conditions.cloudCover} clouds · {report.conditions.weatherCondition}</span>
                </div>
                {report.conditions.waterTemp && (
                  <div className="flex items-start gap-2 text-xs text-white/60">
                    <span>🌊</span>
                    <span>
                      Water {report.conditions.waterTemp}
                      {report.conditions.waterTempSource === 'sensor' && (
                        <span className="ml-1 text-emerald-400/70">● sensor</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sensor Data */}
            {report.sensorData && report.sensorData.length > 0 && (
              <div className="mx-5 mb-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-2">📡 Live Sensor Data</p>
                {report.sensorData.map((s, i) => (
                  <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-white/10' : ''}>

                    {/* Source header — taps through to live data page */}
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-emerald-300/80 text-xs font-medium hover:text-emerald-200 transition-colors group"
                      >
                        <span>{s.source === 'NWS Alerts' ? '⚠️' : s.source === 'NOAA GLERL' ? '🛰️' : '📍'}</span>
                        <span>{s.source} — {s.stationName}</span>
                        <span className="text-white/30">
                          {s.distanceMiles === 0 ? '(satellite)' : `(${s.distanceMiles}mi)`}
                        </span>
                        <span className="text-white/20 group-hover:text-emerald-400/50 transition-colors">↗</span>
                      </a>
                    ) : (
                      <p className="text-emerald-300/80 text-xs font-medium">
                        {s.source === 'NWS Alerts' ? '⚠️' : s.source === 'NOAA GLERL' ? '🛰️' : '📍'}{' '}
                        {s.source} — {s.stationName}{' '}
                        <span className="text-white/30">
                          {s.distanceMiles === 0 ? '(satellite)' : `(${s.distanceMiles}mi)`}
                        </span>
                      </p>
                    )}

                    {/* NWS Alerts: render as warning chips */}
                    {s.source === 'NWS Alerts' && s.alerts && s.alerts.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {s.alerts.map((alert, ai) => (
                          <span key={ai} className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                            {alert}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* All other sources: numerical readings */}
                    {s.source !== 'NWS Alerts' && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        {s.waterTemp && (
                          <span className="text-white/60 text-xs">
                            🌡 Water {s.waterTemp}
                            {s.source === 'NOAA GLERL' && <span className="ml-1 text-sky-400/70">satellite</span>}
                          </span>
                        )}
                        {s.waveHeight && <span className="text-white/60 text-xs">🌊 {s.waveHeight} waves</span>}
                        {s.wavePeriod && <span className="text-white/60 text-xs">⏱ {s.wavePeriod} period</span>}
                        {s.waterLevel && <span className="text-white/60 text-xs">📏 Level {s.waterLevel}</span>}
                        {s.flowRate && <span className="text-white/60 text-xs">💧 Flow {s.flowRate}</span>}
                        {s.gaugeHeight && <span className="text-white/60 text-xs">📏 Stage {s.gaugeHeight}</span>}
                        {s.windSpeed && <span className="text-white/60 text-xs">💨 {s.windSpeed} {s.windDirection ? `from ${s.windDirection}` : ''}</span>}
                        {s.currentStage && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            s.riverStatus?.includes('Flood') ? 'bg-red-500/20 text-red-300' :
                            s.riverStatus?.includes('Action') ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-white/10 text-white/60'
                          }`}>
                            Stage {s.currentStage} · {s.riverStatus}
                          </span>
                        )}
                        {s.actionStage && <span className="text-white/40 text-xs">Action: {s.actionStage}</span>}
                        {s.floodStage && <span className="text-white/40 text-xs">Flood: {s.floodStage}</span>}
                        {s.moderateFloodStage && <span className="text-white/40 text-xs">Mod. Flood: {s.moderateFloodStage}</span>}
                        {s.majorFloodStage && <span className="text-white/40 text-xs">Major Flood: {s.majorFloodStage}</span>}
                        {s.forecastStage && (
                          <span className={`text-xs ${s.forecastTrend === 'Rising' ? 'text-yellow-400/70' : s.forecastTrend === 'Falling' ? 'text-blue-400/70' : 'text-white/40'}`}>
                            {s.forecastTrend === 'Rising' ? '↑' : s.forecastTrend === 'Falling' ? '↓' : '→'} Forecast {s.forecastStage}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Day Timeline */}
            {report.dayTimeline && report.dayTimeline.length > 0 && (
              <DayTimeline timeline={report.dayTimeline} />
            )}

            {/* Risk Flags / Considerations */}
            {report.riskFlags?.length > 0 && (() => {
              const emergencyPattern = /\b(warning|advisory|flood|storm|tornado|hurricane|tsunami|evacuation|emergency|danger)\b/i
              const isWarning = report.riskFlags.some(f => emergencyPattern.test(f))
              return (
                <div className={`mx-5 mb-5 rounded-xl p-3 border ${
                  isWarning
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                    isWarning ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {isWarning ? '⚠️ Warnings' : '💡 Considerations'}
                  </p>
                  {report.riskFlags.map((flag, i) => (
                    <p key={i} className={`text-sm ${isWarning ? 'text-red-300/80' : 'text-amber-200/70'}`}>
                      {flag}
                    </p>
                  ))}
                </div>
              )
            })()}

            {/* Report Body */}
            <div className="px-5 pb-10">
              <Section title="Summary" content={report.summary} />
              <Section title="Why These Conditions Matter" content={report.conditionsInterpretation} />
              <Section title="Tactical Recommendation" content={report.tacticalRecommendation} />

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-white/40 text-xs mb-1">Depth Range</p>
                  <p className="text-white/90 text-sm"><GlossaryText text={report.depthRange} /></p>
                </div>

                <BaitCard baitProfile={report.baitProfile} baitAlternatives={report.baitAlternatives} />

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-white/40 text-xs mb-1">Retrieval Style</p>
                  <p className="text-white/90 text-sm"><GlossaryText text={report.retrievalStyle} /></p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-white/40 text-xs mb-1">Target Structure</p>
                  <p className="text-white/90 text-sm"><GlossaryText text={report.structureTypes} /></p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
