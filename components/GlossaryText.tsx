'use client'
import { useState } from 'react'
import { GLOSSARY } from '@/lib/glossary'

function GlossaryTerm({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="inline">
      <button
        onClick={() => setOpen(o => !o)}
        className="underline decoration-dotted decoration-blue-400/60 text-inherit cursor-pointer"
      >
        {term}
      </button>
      {open && (
        <span className="inline-flex items-start gap-1.5 mx-1 my-1 px-2.5 py-1.5 bg-slate-700 border border-white/10 rounded-lg text-xs text-white/80 leading-relaxed">
          <span className="text-blue-400 mt-0.5 flex-shrink-0">ℹ</span>
          <span>{definition}</span>
        </span>
      )}
    </span>
  )
}

export default function GlossaryText({ text }: { text: string }) {
  if (!text) return null

  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const matched = match[0]
    const key = Object.keys(GLOSSARY).find(k => k.toLowerCase() === matched.toLowerCase())
    if (key) {
      parts.push(
        <GlossaryTerm key={match.index} term={matched} definition={GLOSSARY[key]} />
      )
    }
    lastIndex = match.index + matched.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <span>{parts}</span>
}
