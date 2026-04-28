import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSpeciesContext, SPECIES_PROFILES } from '@/lib/speciesKnowledge'
import { fetchAllSensorData } from '@/lib/sensorData'

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

function scoreWaterTemp(waterTempF: number, species: string): number {
  const profile = SPECIES_PROFILES[species]
  const optimal = profile?.optimalTempRange || { min: 60, max: 75 }
  if (waterTempF >= optimal.min && waterTempF <= optimal.max) return 10
  const dist = waterTempF < optimal.min ? optimal.min - waterTempF : waterTempF - optimal.max
  if (dist <= 5) return 7
  if (dist <= 10) return 4
  if (dist <= 15) return 2
  return 0
}

function scoreConditions(
  current: Record<string, number>,
  pressureTrend: number,
  species = 'general',
  waterTempF?: number
) {
  const scores = { pressure: 0, wind: 0, clouds: 0, weather: 0, airTemp: 0, waterTemp: 0 }

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
  if (temp >= 55 && temp <= 72) scores.airTemp = 10
  else if ((temp >= 45 && temp < 55) || (temp > 72 && temp <= 80)) scores.airTemp = 7
  else if ((temp >= 35 && temp < 45) || (temp > 80 && temp <= 90)) scores.airTemp = 4
  else scores.airTemp = 2

  if (waterTempF != null) scores.waterTemp = scoreWaterTemp(waterTempF, species)

  const baseTotal = scores.pressure + scores.wind + scores.clouds + scores.weather + scores.airTemp
  const total = baseTotal + scores.waterTemp
  const maxPossible = waterTempF != null ? 110 : 100
  const overallScore = Math.min(10, Math.max(1, Math.round((total / maxPossible) * 10)))

  return { scores, total, overallScore }
}

function buildDayTimeline(
  hourly: Record<string, (number | string)[]>,
  species: string,
  currentScore: number,
  waterTempF?: number
): Array<{ hour: number; label: string; score: number; quality: string }> {
  const times: string[] = (hourly.time as string[]) || []
  if (!times.length) return []

  // With past_hours=3 + forecast_hours=24, Open-Meteo always places the current
  // local hour at index 3 — no server/client timezone comparison needed.
  // Show current hour + next 12 hours = 13 slots total.
  const START_IDX = 3
  const SLOTS = 13

  const timeline = []

  for (let i = START_IDX; i < times.length && timeline.length < SLOTS; i++) {
    const timeStr = times[i]
    if (!timeStr) continue
    const hour = parseInt(timeStr.slice(11, 13), 10)

    // For the "Now" slot use the already-calculated main score so both cards agree
    let score: number
    if (timeline.length === 0) {
      score = currentScore
    } else {
      const current = {
        wind_speed_10m: (hourly.wind_speed_10m?.[i] as number) ?? 10,
        cloud_cover: (hourly.cloud_cover?.[i] as number) ?? 50,
        surface_pressure: (hourly.surface_pressure?.[i] as number) ?? 1013,
        weather_code: (hourly.weather_code?.[i] as number) ?? 0,
        temperature_2m: (hourly.temperature_2m?.[i] as number) ?? 65,
      }
      const prevPressure = (hourly.surface_pressure?.[Math.max(0, i - 3)] as number) ?? current.surface_pressure
      const pressureTrend = current.surface_pressure - prevPressure
      score = scoreConditions(current, pressureTrend, species, waterTempF).overallScore
    }

    const isPM = hour >= 12
    const label = hour === 0 ? '12am' : hour === 12 ? '12pm' : isPM ? `${hour - 12}pm` : `${hour}am`
    const quality = score >= 8 ? 'excellent' : score >= 6 ? 'good' : score >= 4 ? 'fair' : 'poor'

    timeline.push({ hour, label, score, quality })
  }

  return timeline
}

// Bounding boxes for the five Great Lakes (generous margins to catch near-shore pins)
const GREAT_LAKE_BOUNDS = [
  { name: 'Lake Michigan', n: 46.1, s: 41.6, e: -84.7, w: -88.0 },
  { name: 'Lake Superior', n: 49.0, s: 46.3, e: -84.3, w: -92.2 },
  { name: 'Lake Huron',    n: 46.4, s: 43.0, e: -79.7, w: -84.7 },
  { name: 'Lake Erie',     n: 42.9, s: 41.4, e: -78.9, w: -83.5 },
  { name: 'Lake Ontario',  n: 44.0, s: 43.1, e: -76.0, w: -79.9 },
]

function detectGreatLake(lat: number, lng: number): string | null {
  for (const lake of GREAT_LAKE_BOUNDS) {
    if (lat >= lake.s && lat <= lake.n && lng >= lake.w && lng <= lake.e) return lake.name
  }
  return null
}

function classifyWaterBody(locationName: string, lat?: number, lng?: number): { type: string; context: string } {
  // Coordinate-based Great Lake detection takes priority over name matching —
  // prevents cities like "Lake Bluff, IL" from being misclassified
  if (lat != null && lng != null) {
    const lakeName = detectGreatLake(lat, lng)
    if (lakeName) return {
      type: 'Great Lake',
      context: `WATER BODY: ${lakeName} (Great Lake). Treat this as open, cold, deep water — think like a sea. Depths can exceed 900ft. Focus on nearshore structure (shoals, rocky points, piers, harbor mouths) in shallower zones, and offshore trolling in open water. Realistic species: Salmon, Trout (lake/brown/rainbow/steelhead), Walleye, Smallmouth Bass, Yellow Perch, Pike in harbors/river mouths. Largemouth Bass and Panfish are limited to protected harbor/bay areas only. Wave action, thermoclines, and boat traffic are significant factors. Depth ranges and structure must reflect this massive scale.`,
    }
  }

  const name = locationName.toLowerCase()

  const isGreatLake = /\b(lake michigan|lake superior|lake huron|lake erie|lake ontario)\b/.test(name)
  const isSaltwater = /\b(ocean|sea|gulf|sound|strait|bay|harbor|harbour|inlet|cove|estuary|tidal|saltwater|offshore|atlantic|pacific|chesapeake|puget)\b/.test(name)
  const isLake = /\b(lake|reservoir|impoundment|loch)\b/.test(name)
  const isLargeRiver = /\b(mississippi|missouri|ohio|columbia|colorado|snake|tennessee|arkansas|rio grande|hudson|delaware|susquehanna|potomac|sacramento|san joaquin)\b/.test(name)
  const isRiver = /\b(river|creek|stream|brook|run|fork|tributary|rapids|falls|rio|bayou|slough)\b/.test(name)
  const isPond = /\b(pond|pool|retention|urban|park|farm|private)\b/.test(name)

  if (isGreatLake) return {
    type: 'Great Lake',
    context: `WATER BODY: Great Lake (${locationName}). Treat this as open, cold, deep water — think like a sea. Depths can exceed 900ft. Focus on nearshore structure (shoals, rocky points, piers, harbor mouths) in shallower zones, and offshore trolling in open water. Realistic species: Salmon, Trout (lake/brown/rainbow/steelhead), Walleye, Smallmouth Bass, Yellow Perch, Pike in harbors/river mouths. Largemouth Bass and Panfish are limited to protected harbor/bay areas only. Pike/Muskie possible near river mouths and shallow bays. Wave action, thermoclines, and boat traffic are significant factors. Depth ranges and structure must reflect this massive scale.`,
  }

  if (isSaltwater) return {
    type: 'Saltwater / Coastal',
    context: `WATER BODY: Saltwater or coastal environment. Adjust all recommendations for saltwater: tides, salinity, and currents are primary drivers of fish movement. Freshwater species (bass, walleye, panfish, pike) are NOT present. Realistic species include: Striped Bass, Flounder, Redfish, Snook, Tarpon, Bluefish, Weakfish, Sheepshead, Drum, and local saltwater species. If the user selected a freshwater species, flag it as not applicable and recommend appropriate saltwater alternatives.`,
  }

  if (isPond) return {
    type: 'Small Pond',
    context: `WATER BODY: Small pond or urban water body. Maximum depth likely 3-15ft. Species realistically present: Largemouth Bass, Panfish (Bluegill, Crappie), Catfish, and possibly Carp. Pike/Muskie, Walleye, Salmon, Trout, and Smallmouth Bass are NOT realistic in a small pond — flag this clearly if selected. Structure is limited: focus on shoreline cover, dock edges, lily pads, any submerged timber or inlet. Depth range should reflect the shallow nature (2-8ft typical). Tactics should be close-quarters and finesse-oriented.`,
  }

  if (isLargeRiver) return {
    type: 'Large River',
    context: `WATER BODY: Large river system. Current is the dominant factor — fish relate to current breaks, eddies, wing dams, outside bends, deep holes, and slack water behind structure. Realistic species vary by region but typically include: Catfish, Walleye, Smallmouth Bass, Largemouth Bass (backwater areas), Pike, Panfish, Carp, and migratory species (Salmon/Steelhead on certain rivers). Depth recommendations should reference current seams and holes. Structure = wing dams, rock piles, bridge pilings, outside bends, submerged islands. Retrieval style must account for current direction.`,
  }

  if (isRiver) return {
    type: 'River / Stream',
    context: `WATER BODY: River or stream. Current is the primary fish-positioning factor. Fish hold in eddies, behind boulders, in pools below riffles, along cut banks, and at tributary mouths. Realistic species: Trout (in cold, clear streams), Smallmouth Bass (rocky rivers), Largemouth Bass (warmer slower rivers), Panfish, Pike, Walleye in larger rivers. Salmon in appropriate migratory rivers. Depth ranges are typically shallow (1-10ft in riffles/runs, deeper in pools). Bait and presentation must work with or across current. Flag species that don't match river type (e.g., Muskie in a small trout stream).`,
  }

  if (isLake) return {
    type: 'Lake / Reservoir',
    context: `WATER BODY: Lake or reservoir. Tailor recommendations to a standard inland lake or reservoir. Consider depth variation — most productive zones are near structure: points, drop-offs, weed edges, submerged timber, dam faces (reservoirs). All standard freshwater species are plausible depending on region: Bass, Walleye, Pike/Muskie, Panfish, Catfish, Trout (if cold/deep enough). Use the specific lake name and region to infer likely species — a southern reservoir won't have Muskie or Salmon; a deep northern lake won't hold tropical species. Depth recommendations should reflect typical structure fishing (5-25ft range is common).`,
  }

  return {
    type: 'Unknown water body',
    context: `WATER BODY: Type unclear from location name. Use the full location name, coordinates, and your knowledge to infer the water body type (lake, river, ocean, pond, etc.) and adjust ALL recommendations accordingly — species availability, depth, structure, and tactics must reflect what is realistic for the actual water. Do not give generic advice; make your best inference about the water type.`,
  }
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

    const waterBody = classifyWaterBody(locationName, lat, lng)

    const [weatherRes, waterTemp, sensorBundle] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,surface_pressure,weather_code,relative_humidity_2m&hourly=temperature_2m,wind_speed_10m,cloud_cover,surface_pressure,weather_code&past_hours=3&forecast_hours=24&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto`
      ),
      fetchWaterTemp(lat, lng),
      fetchAllSensorData(lat, lng, waterBody.type),
    ])

    const weatherData = await weatherRes.json()
    const current = weatherData.current
    const hourlyPressure: number[] = weatherData.hourly?.surface_pressure || []
    const pressureTrend = hourlyPressure.length >= 2
      ? hourlyPressure[hourlyPressure.length - 1] - hourlyPressure[0]
      : 0

    // Resolve best available water temp: sensor first, marine model fallback
    const sensorWaterTemp = sensorBundle.readings.find(r => r.waterTemp)?.waterTemp
    const bestWaterTemp = sensorWaterTemp || waterTemp
    const waterTempF = bestWaterTemp ? parseFloat(bestWaterTemp) : undefined

    const { scores, overallScore } = scoreConditions(current, pressureTrend, species, waterTempF)
    const dayTimeline = buildDayTimeline(weatherData.hourly ?? {}, species, overallScore, waterTempF)

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
      waterTemp: bestWaterTemp ?? undefined,
      waterTempSource: sensorWaterTemp ? 'sensor' : waterTemp ? 'model' : undefined,
    }

    const waterTempLine = bestWaterTemp
      ? `Water Temperature (${sensorWaterTemp ? 'sensor' : 'marine model'}): ${bestWaterTemp}`
      : 'Water Temperature: Not available'

    const sensorLines = sensorBundle.readings.length > 0
      ? '\nREAL SENSOR DATA (from physical monitoring stations — prioritize this over modeled data):\n' +
        sensorBundle.readings.map(r => {
          const parts = [`[${r.source} — ${r.stationName}, ${r.distanceMiles}mi away]`]
          if (r.waterTemp) parts.push(`  Water Temp: ${r.waterTemp}`)
          if (r.waveHeight) parts.push(`  Wave Height: ${r.waveHeight}`)
          if (r.wavePeriod) parts.push(`  Wave Period: ${r.wavePeriod}`)
          if (r.waterLevel) parts.push(`  Water Level: ${r.waterLevel}`)
          if (r.flowRate) parts.push(`  Flow Rate: ${r.flowRate}`)
          if (r.gaugeHeight) parts.push(`  Gauge Height: ${r.gaugeHeight}`)
          if (r.windSpeed) parts.push(`  Wind (buoy): ${r.windSpeed}${r.windDirection ? ` from ${r.windDirection}` : ''}`)
          if (r.currentStage) parts.push(`  Current Stage: ${r.currentStage}`)
          if (r.riverStatus) parts.push(`  River Status: ${r.riverStatus}`)
          if (r.actionStage) parts.push(`  Action Stage Threshold: ${r.actionStage}`)
          if (r.floodStage) parts.push(`  Minor Flood Stage Threshold: ${r.floodStage}`)
          if (r.moderateFloodStage) parts.push(`  Moderate Flood Stage: ${r.moderateFloodStage}`)
          if (r.majorFloodStage) parts.push(`  Major Flood Stage: ${r.majorFloodStage}`)
          if (r.forecastStage) parts.push(`  Forecast (next 12h): ${r.forecastStage} — ${r.forecastTrend}`)
          return parts.join('\n')
        }).join('\n')
      : ''

    const speciesContext = getSpeciesContext(species)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a fishing intelligence engine. Analyze these real-time conditions and generate a fishing report specifically for ${speciesLabel}.

${speciesContext}

${waterBody.context}

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
${waterTempLine}${sensorLines}
Overall Fishing Score: ${overallScore}/10
Score Breakdown — Pressure: ${scores.pressure}/25, Wind: ${scores.wind}/20, Clouds: ${scores.clouds}/15, Weather: ${scores.weather}/15, Air Temp: ${scores.airTemp}/10${waterTempF != null ? `, Water Temp (${speciesLabel}): ${scores.waterTemp}/10` : ''}

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
      sensorData: sensorBundle.hasRealData ? sensorBundle.readings : null,
      dayTimeline,
    })
  } catch (error) {
    console.error('Report error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
