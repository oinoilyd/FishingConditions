'use client'
import { useEffect, useState } from 'react'

const STEPS = [
  'Fetching real-time weather data',
  'Analyzing pressure trends',
  'Scoring fishing conditions',
  'Generating your fishing report',
]

export default function LoadingReport() {
  const [currentStep, setCurrentStep] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const timers = [
      setTimeout(() => setCurrentStep(1), 3000),
      setTimeout(() => setCurrentStep(2), 7000),
      setTimeout(() => setCurrentStep(3), 11000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="mt-6 bg-white/5 rounded-2xl p-5 border border-white/10">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg animate-pulse">🎣</span>
        <p className="text-white font-semibold text-sm">Analyzing conditions{dots}</p>
      </div>
      <div className="space-y-3.5">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
              i < currentStep ? 'bg-green-500 text-white' :
              i === currentStep ? 'bg-blue-500 animate-pulse' :
              'bg-white/10'
            }`}>
              {i < currentStep ? '✓' : ''}
            </div>
            <p className={`text-sm transition-all duration-500 ${
              i < currentStep ? 'text-white/40 line-through' :
              i === currentStep ? 'text-white' :
              'text-white/20'
            }`}>{step}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
