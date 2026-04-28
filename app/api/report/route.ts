import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSpeciesContext } from '@/lib/speciesKnowledge'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SPECIES_LABELS: Record<string, string> = {
  'general': 'all species (general)',
  'largemouth-bass': 'Largemouth Bass',
  'smallmouth-bass': 'Smallmouth Bass',
  'walleye': 'Walleye',
  'pike': 'Northern Pike / Muskie',
  'trout': 'Trout (Brown / Rainbow)',
  'salmon': 'Salmon',
  'catfish': 'Catfish',
  'panfish': 'Panfish / Crappie / Bluegill',
}

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 57) return 'Light drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 94) return 'Thunderstorm'
  return 'Severe thunderstorm'
}

function scoreConditions(current: Record<string, number>, pressureTrend: number) {
  const scores = { pressure: 0, wind: 0, clouds: 0, weather: 0, temperature: 0 }

  if (pressureTrend < -2) scores.pressure = 22
  else if (pressureTrend < -0.5) scores.pressure = 25
  else if (Math.abs(pressureTrend) <= 0.5) scores.pressure = 15
  else if (pressureTrend < 2) scores.pressure = 10
  else scores.pressure = 5

  const wind = current.wind_speed_10m
  if (wind >= 5 && wind <= 15) scores.wind = 20
  else if (wind < 5) scores.wind = 12
  else if (wind <= 20) scores.wind = 10
  else if (wind <= 30) scores.wind = 5
  else scores.wind = 0

  const clouds = current.cloud_cover
  if (clouds >= 75) scores.clouds = 15
  else if (clouds >= 25) scores.clouds = 12
  else scores.clouds = 8

  const code = current.weather_code
  if (code <= 3) scores.weather = 10
  else if (code <= 48) scores.weather = 6
  else if (code <= 57) scores.weather = 14
  else if (code <= 67) scores.weather = 12
  else if (code <= 82) scores.weather = 8
  else scores.weather = 2

  const temp = current.temperature_2m
  if (temp >= 55 && temp <= 72) scores.temperature = 15
  else if ((temp >= 45 && temp < 55) || (temp > 72 && temp <= 80)) scores.temperature = 10
  else if ((temp >= 35 && temp < 45) || (temp > 80 && temp <= 90)) scores.temperature = 5
  else scores.temperature = 2

  const total = scores.pressure + scores.wind + scores.clouds + scores.weather + scores.temperature
  const overallScore = Math.min(10, Math.max(1, Math.round(total / 10)))

  return { scores, total, overallScore }
}

async function fetchWaterTemp(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=sea_surface_temperature`
    )
    const data = await res.json()
    if (data.current?.sea_surface_temperature != null) {
      const tempF = Math.round(data.current.sea_surface_temperature * 9 / 5 + 32)
      return `${tempF}°F`
    }
  } catch {
    // Not available for this location
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { lat, lng, locationName, species = 'general', localTime, localDate } = await req.json()
    const speciesLabel = SPECIES_LABELS[species] || 'all species'

    const [weatherRes, waterTemp] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,surface_pressure,weather_code,relative_humidity_2m&hourly=surface_pressure&past_hours=3&forecast_hours=1&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto`
      ),
      fetchWaterTemp(lat, lng),
    ])

    const weatherData = await weatherRes.json()
    const current = weatherData.current
    const hourlyPressure: number[] = weatherData.hourly?.surface_pressure || []
    const pressureTrend = hourlyPressure.length >= 2
      ? hourlyPressure[hourlyPressure.length - 1] - hourlyPressure[0]
      : 0

    const { scores, overallScore } = scoreConditions(current, pressureTrend)

    const pressureTrendLabel =
      pressureTrend < -2 ? 'Falling rapidly' :
      pressureTrend < -0.5 ? 'Falling slowly' :
      Math.abs(pressureTrend) <= 0.5 ? 'Stable' :
      pressureTrend < 2 ? 'Rising slowly' : 'Rising rapidly'

    const conditions = {
      temperature: `${Math.round(current.temperature_2m)}°F`,
      wind: `${Math.round(current.wind_speed_10m)} mph from ${degreesToCardinal(current.wind_direction_10m)}, gusts to ${Math.round(current.wind_gusts_10m)} mph`,
      pressure: `${Math.round(current.surface_pressure)} hPa — ${pressureTrendLabel} (${pressureTrend > 0 ? '+' : ''}${pressureTrend.toFixed(1)} hPa / 3hr)`,
      cloudCover: `${current.cloud_cover}%`,
      weatherCondition: weatherCodeToLabel(current.weather_code),
      humidity: `${current.relative_humidity_2m}%`,
      precipitation: `${current.precipitation} mm`,
      waterTemp: waterTemp ?? undefined,
    }

    const waterTempLine = waterTemp ? `Water Temperature: ${waterTemp}` : 'Water Temperature: Not available for this location (use air temp and season to estimate)'

    const speciesContext = getSpeciesContext(species)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a fishing intelligence engine. Analyze these real-time conditions and generate a fishing report specifically for ${speciesLabel}.

${speciesContext}


Location: ${locationName}
Current Time: ${localTime} on ${localDate}
Target Species: ${speciesLabel}
Temperature: ${conditions.temperature}
Wind: ${conditions.wind}
Barometric Pressure: ${conditions.pressure}
Cloud Cover: ${conditions.cloudCover}
Weather: ${conditions.weatherCondition}
Humidity: ${conditions.humidity}
Precipitation: ${conditions.precipitation}
${waterTempLine}
Overall Fishing Score: ${overallScore}/10
Score Breakdown — Pressure: ${scores.pressure}/25, Wind: ${scores.wind}/20, Clouds: ${scores.clouds}/15, Weather: ${scores.weather}/15, Temperature: ${scores.temperature}/15

Keep responses focused and useful — not too brief, not too long. Narrative fields should be 2-3 sentences with real insight. Grid fields should be concise phrases. Reference the specific current time (${localTime}) where relevant — never say "early feeding window", say "at ${localTime} fish are doing X."

Return ONLY a valid JSON object with exactly these fields, no extra text:
{
  "summary": "2-3 sentences on overall conditions and fishing outlook for ${speciesLabel}",
  "conditionsInterpretation": "2-3 sentences explaining how current pressure, wind, and weather affect ${speciesLabel} behavior",
  "tacticalRecommendation": "2-3 sentences of specific, actionable advice for right now",
  "depthRange": "Concise answer, e.g. '6-12ft near drop-offs'",
  "baitProfile": "Top 2 best bait options as a short phrase",
  "baitAlternatives": ["3 to 4 additional bait or lure options as short strings"],
  "retrievalStyle": "Concise answer, e.g. 'Slow roll with occasional pause'",
  "structureTypes": "Concise answer, e.g. 'Rocky points, weed edges, submerged timber'",
  "riskFlags": ["short warning phrases only, empty array if none — if the location name suggests a small or urban water body where ${speciesLabel} are realistically absent (e.g. Pike/Muskie in a small pond), add a flag like 'Pike/Muskie unlikely here — water body too small'"]
}`
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected Claude response type')

    const cleaned = content.text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const report = JSON.parse(cleaned)

    return NextResponse.json({
      ...report,
      score: overallScore,
      locationName,
      species,
      conditions,
    })
  } catch (error) {
    console.error('Report error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
