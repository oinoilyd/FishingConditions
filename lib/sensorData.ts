export interface SensorReading {
  source: 'NOAA NDBC' | 'USGS' | 'NOAA CO-OPS' | 'NOAA NWPS' | 'NOAA GLERL' | 'NWS Alerts'
  stationName: string
  stationId: string
  distanceMiles: number
  // Water conditions
  waterTemp?: string
  waveHeight?: string
  wavePeriod?: string
  waterLevel?: string
  // River gauges
  flowRate?: string
  gaugeHeight?: string
  // NWPS river forecast & stage
  currentStage?: string
  actionStage?: string
  floodStage?: string
  moderateFloodStage?: string
  majorFloodStage?: string
  riverStatus?: string
  forecastStage?: string
  forecastTrend?: string
  // Wind (buoys)
  windSpeed?: string
  windDirection?: string
  // NWS active weather alerts
  alerts?: string[]
}

export interface SensorBundle {
  readings: SensorReading[]
  hasRealData: boolean
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseVal(v: string): string | undefined {
  return v && v !== 'MM' && v !== 'N/A' && v !== '9999' && v !== '999' && v !== '99.00' ? v : undefined
}

function nwpsStatusLabel(category: string): string {
  const map: Record<string, string> = {
    'no_flooding': 'Normal',
    'action': 'Near Action Stage',
    'minor': 'Minor Flood',
    'moderate': 'Moderate Flood',
    'major': 'Major Flood',
    'record': 'Record Flood',
  }
  return map[category] || category
}

// ─── NOAA NDBC ────────────────────────────────────────────────────────────────
// Physical buoys: wave height, water temp, wind. Radius bumped to 300mi so
// Great Lakes buoys (which can be well off-shore) are not dropped.
async function fetchNDBC(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const stationsRes = await fetch(
      'https://www.ndbc.noaa.gov/data/stations/active_stations.xml',
      { next: { revalidate: 3600 } }
    )
    const xml = await stationsRes.text()

    const stationRe = /id="([^"]+)"[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*name="([^"]+)"/g
    let best: { id: string; name: string; dist: number } | null = null
    let match: RegExpExecArray | null

    while ((match = stationRe.exec(xml)) !== null) {
      const [, id, slat, slng, name] = match
      const dist = haversine(lat, lng, parseFloat(slat), parseFloat(slng))
      if (!best || dist < best.dist) {
        best = { id, name, dist }
      }
    }

    if (!best) return null

    const dataRes = await fetch(
      `https://www.ndbc.noaa.gov/data/realtime2/${best.id}.txt`,
      { next: { revalidate: 1800 } }
    )
    const text = await dataRes.text()
    const lines = text.split('\n').filter(l => !l.startsWith('#') && l.trim())
    if (!lines[0]) return null

    const headers = text.split('\n')[0].replace('#', '').trim().split(/\s+/)
    const values = lines[0].trim().split(/\s+/)
    const get = (key: string) => parseVal(values[headers.indexOf(key)] || '')

    const waterTemp = get('WTMP')
    const waveHeight = get('WVHT')
    const wavePeriod = get('DPD')
    const windSpeed = get('WSPD')
    const windDir = get('WDIR')

    // Accept reading if any useful field is present (not just temp+waves)
    if (!waterTemp && !waveHeight && !windSpeed) return null

    return {
      source: 'NOAA NDBC',
      stationName: best.name,
      stationId: best.id,
      distanceMiles: Math.round(best.dist),
      waterTemp: waterTemp ? `${Math.round(parseFloat(waterTemp) * 9 / 5 + 32)}°F` : undefined,
      waveHeight: waveHeight ? `${(parseFloat(waveHeight) * 3.281).toFixed(1)} ft` : undefined,
      wavePeriod: wavePeriod ? `${wavePeriod}s` : undefined,
      windSpeed: windSpeed ? `${Math.round(parseFloat(windSpeed) * 2.237)} mph` : undefined,
      windDirection: windDir,
    }
  } catch {
    return null
  }
}

// ─── NOAA GLERL ───────────────────────────────────────────────────────────────
// Satellite-derived Great Lakes surface water temperature via GLERL CoastWatch
// ERDDAP (GLSEA4 dataset). Most reliable water-temp source for the Great Lakes —
// covers the whole lake even when buoys are offline.
async function fetchGLERL(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const url =
      `https://coastwatch.glerl.noaa.gov/erddap/griddap/glsea4.json` +
      `?surface_temperature[(last)][${lat.toFixed(4)}:1:${lat.toFixed(4)}][${lng.toFixed(4)}:1:${lng.toFixed(4)}]`

    const res = await fetch(url, { next: { revalidate: 43200 } }) // 12h cache — daily satellite product
    if (!res.ok) return null
    const data = await res.json()

    // ERDDAP table format: { table: { columnNames: [...], rows: [[time, lat, lng, temp]] } }
    const rows = data?.table?.rows
    if (!rows?.length) return null

    const cols: string[] = data.table.columnNames
    const tempIdx = cols.findIndex((c: string) => c.toLowerCase().includes('surface_temperature') || c.toLowerCase().includes('temperature'))
    if (tempIdx < 0) return null

    const tempC = rows[0][tempIdx]
    if (tempC == null || tempC === 'NaN') return null

    const tempF = Math.round(parseFloat(tempC) * 9 / 5 + 32)

    return {
      source: 'NOAA GLERL',
      stationName: 'Great Lakes Surface Analysis (Satellite)',
      stationId: 'GLSEA4',
      distanceMiles: 0,
      waterTemp: `${tempF}°F`,
    }
  } catch {
    return null
  }
}

// ─── USGS ─────────────────────────────────────────────────────────────────────
// River flow, gauge height, water temp. Bounding box expanded to 1.5° for
// River/Stream types so stations on winding rivers aren't missed.
async function fetchUSGS(lat: number, lng: number, siteType: 'ST' | 'LK' = 'ST'): Promise<SensorReading | null> {
  try {
    const pad = siteType === 'ST' ? 1.5 : 0.75
    const bbox = `${(lng - pad).toFixed(3)},${(lat - pad).toFixed(3)},${(lng + pad).toFixed(3)},${(lat + pad).toFixed(3)}`
    const res = await fetch(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00010,00060,00065&period=PT2H&siteType=${siteType}&siteStatus=active`,
      { next: { revalidate: 1800 } }
    )
    const data = await res.json()
    const sites = data?.value?.timeSeries
    if (!sites?.length) return null

    let best: { idx: number; dist: number } | null = null
    for (let i = 0; i < sites.length; i++) {
      const geo = sites[i]?.sourceInfo?.geoLocation?.geogLocation
      if (!geo) continue
      const dist = haversine(lat, lng, geo.latitude, geo.longitude)
      if (!best || dist < best.dist) best = { idx: i, dist }
    }
    if (!best) return null

    const siteName = sites[best.idx]?.sourceInfo?.siteName || 'Unknown'
    const siteCode = sites[best.idx]?.sourceInfo?.siteCode?.[0]?.value || ''

    let waterTemp: string | undefined
    let flowRate: string | undefined
    let gaugeHeight: string | undefined

    for (const ts of sites.filter((s: { sourceInfo?: { siteCode?: { value?: string }[] } }) =>
      s?.sourceInfo?.siteCode?.[0]?.value === siteCode
    )) {
      const paramCode = ts?.variable?.variableCode?.[0]?.value
      const val = ts?.values?.[0]?.value
      const latest = val?.[val.length - 1]?.value
      if (!latest || latest === '-999999') continue

      if (paramCode === '00010') {
        waterTemp = `${Math.round(parseFloat(latest) * 9 / 5 + 32)}°F`
      } else if (paramCode === '00060') {
        flowRate = `${Math.round(parseFloat(latest)).toLocaleString()} cfs`
      } else if (paramCode === '00065') {
        gaugeHeight = `${parseFloat(latest).toFixed(2)} ft`
      }
    }

    if (!waterTemp && !flowRate && !gaugeHeight) return null

    return {
      source: 'USGS',
      stationName: siteName,
      stationId: siteCode,
      distanceMiles: Math.round(best.dist),
      waterTemp,
      flowRate,
      gaugeHeight,
    }
  } catch {
    return null
  }
}

// ─── NOAA CO-OPS ──────────────────────────────────────────────────────────────
// Great Lakes + coastal water temp and levels. Fetches BOTH waterlevels AND
// watertemperature station types so Great Lakes stations that only report temp
// aren't dropped from the list.
async function fetchCOOPS(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    // Fetch both station types in parallel — Great Lakes stations often only
    // appear under 'watertemperature', not 'waterlevels'
    const [levelsRes, tempRes] = await Promise.allSettled([
      fetch('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels&units=english',
        { next: { revalidate: 3600 } }),
      fetch('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=watertemperature&units=english',
        { next: { revalidate: 3600 } }),
    ])

    const stationMap = new Map<string, { id: string; name: string; lat: number; lng: number }>()

    for (const result of [levelsRes, tempRes]) {
      if (result.status !== 'fulfilled') continue
      const d = await result.value.json()
      for (const s of d?.stations || []) {
        if (!stationMap.has(s.id)) {
          stationMap.set(s.id, { id: s.id, name: s.name, lat: parseFloat(s.lat), lng: parseFloat(s.lng) })
        }
      }
    }

    let best: { id: string; name: string; dist: number } | null = null
    for (const s of stationMap.values()) {
      const dist = haversine(lat, lng, s.lat, s.lng)
      if (!best || dist < best.dist) {
        best = { id: s.id, name: s.name, dist }
      }
    }
    if (!best) return null

    const now = new Date()
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const end = fmt(now)
    const start = fmt(new Date(now.getTime() - 3600000))
    const encode = (s: string) => s.replace(' ', '%20')

    const [waterTempRes, waterLevelRes] = await Promise.allSettled([
      fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&station=${best.id}&begin_date=${encode(start)}&end_date=${encode(end)}&time_zone=GMT&units=english&format=json`),
      fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&station=${best.id}&begin_date=${encode(start)}&end_date=${encode(end)}&time_zone=GMT&units=english&datum=MLLW&format=json`),
    ])

    let waterTemp: string | undefined
    let waterLevel: string | undefined

    if (waterTempRes.status === 'fulfilled') {
      const d = await waterTempRes.value.json()
      const latest = d?.data?.[d.data.length - 1]?.v
      if (latest && latest !== '-') waterTemp = `${parseFloat(latest).toFixed(1)}°F`
    }

    if (waterLevelRes.status === 'fulfilled') {
      const d = await waterLevelRes.value.json()
      const latest = d?.data?.[d.data.length - 1]?.v
      if (latest && latest !== '-') waterLevel = `${parseFloat(latest).toFixed(2)} ft`
    }

    if (!waterTemp && !waterLevel) return null

    return {
      source: 'NOAA CO-OPS',
      stationName: best.name,
      stationId: best.id,
      distanceMiles: Math.round(best.dist),
      waterTemp,
      waterLevel,
    }
  } catch {
    return null
  }
}

// ─── NOAA NWPS ────────────────────────────────────────────────────────────────
// River stage, flood thresholds, status, and 12h forecast via ArcGIS MapServer
async function fetchNWPS(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const pad = 0.75
    const bbox = `${(lng - pad).toFixed(3)},${(lat - pad).toFixed(3)},${(lng + pad).toFixed(3)},${(lat + pad).toFixed(3)}`

    const arcRes = await fetch(
      `https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/riv_gauges/MapServer/0/query?geometry=${bbox}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=*&f=json`,
      { next: { revalidate: 1800 } }
    )
    const arcData = await arcRes.json()
    const features = arcData?.features || []
    if (!features.length) return null

    let best: { lid: string; name: string; dist: number } | null = null
    for (const f of features) {
      const fLat = f.geometry?.y ?? f.attributes?.latitude ?? f.attributes?.lat
      const fLng = f.geometry?.x ?? f.attributes?.longitude ?? f.attributes?.lon
      if (!fLat || !fLng) continue
      const dist = haversine(lat, lng, fLat, fLng)
      const lid = f.attributes?.gaugeID || f.attributes?.lid || f.attributes?.STAID
      const name = f.attributes?.name || f.attributes?.STANAME || lid
      if (lid && (!best || dist < best.dist)) {
        best = { lid, name, dist }
      }
    }
    if (!best) return null

    const nwpsRes = await fetch(
      `https://api.water.noaa.gov/nwps/v1/gauges/${best.lid}`,
      { next: { revalidate: 1800 } }
    )
    const gauge = await nwpsRes.json()

    const obs = gauge?.stageflow?.observed
    const forecast = gauge?.stageflow?.forecast || []
    const categories = gauge?.flood?.categories || {}
    const statusCat = gauge?.status?.observed?.floodCategory || 'no_flooding'

    const currentStage = obs?.primary != null ? `${obs.primary.toFixed(2)} ft` : undefined
    const actionStage = categories?.action?.stage != null ? `${categories.action.stage} ft` : undefined
    const floodStage = categories?.minor?.stage != null ? `${categories.minor.stage} ft` : undefined
    const moderateFloodStage = categories?.moderate?.stage != null ? `${categories.moderate.stage} ft` : undefined
    const majorFloodStage = categories?.major?.stage != null ? `${categories.major.stage} ft` : undefined
    const riverStatus = nwpsStatusLabel(statusCat)

    let forecastStage: string | undefined
    let forecastTrend: string | undefined
    if (forecast.length > 0 && obs?.primary != null) {
      const next12h = forecast.filter((f: { timestamp: string }) => {
        const t = new Date(f.timestamp).getTime()
        return t > Date.now() && t < Date.now() + 12 * 3600000
      })
      if (next12h.length > 0) {
        const vals = next12h.map((f: { primary: number }) => f.primary).filter((v: number) => v != null)
        if (vals.length) {
          const peak = Math.max(...vals)
          forecastStage = `${peak.toFixed(2)} ft (next 12h)`
          forecastTrend = peak > obs.primary + 0.1 ? 'Rising' : peak < obs.primary - 0.1 ? 'Falling' : 'Steady'
        }
      }
    }

    if (!currentStage && !riverStatus) return null

    return {
      source: 'NOAA NWPS',
      stationName: best.name,
      stationId: best.lid,
      distanceMiles: Math.round(best.dist),
      currentStage,
      actionStage,
      floodStage,
      moderateFloodStage,
      majorFloodStage,
      riverStatus,
      forecastStage,
      forecastTrend,
    }
  } catch {
    return null
  }
}

// ─── NWS Alerts ───────────────────────────────────────────────────────────────
// Active weather alerts from api.weather.gov — no API key required.
// Filters for alerts relevant to fishing: flood warnings, wind advisories,
// small craft advisories, dense fog, etc.
const FISHING_ALERT_EVENTS = new Set([
  'Flood Warning', 'Flash Flood Warning', 'Flash Flood Watch',
  'Flood Advisory', 'Flood Watch',
  'Small Craft Advisory', 'Small Craft Advisory for Hazardous Seas',
  'High Wind Warning', 'High Wind Watch', 'Wind Advisory',
  'Lake Wind Advisory', 'Lakeshore Flood Advisory', 'Lakeshore Flood Warning',
  'Coastal Flood Advisory', 'Coastal Flood Warning',
  'Dense Fog Advisory', 'Dense Smoke Advisory',
  'Rip Current Statement', 'Beach Hazards Statement',
  'Winter Storm Warning', 'Ice Storm Warning', 'Blizzard Warning',
  'Severe Thunderstorm Warning', 'Tornado Warning',
  'Special Marine Warning',
])

async function fetchNWSAlerts(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`,
      {
        headers: { 'User-Agent': 'CastIQ/1.0 (fishing conditions app)' },
        next: { revalidate: 900 }, // 15 min cache
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const features = data?.features || []

    const relevantAlerts = features
      .filter((f: { properties: { event: string } }) => FISHING_ALERT_EVENTS.has(f.properties?.event))
      .map((f: { properties: { event: string } }) => f.properties.event)
      // Deduplicate
      .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)

    if (!relevantAlerts.length) return null

    return {
      source: 'NWS Alerts',
      stationName: 'National Weather Service',
      stationId: 'NWS',
      distanceMiles: 0,
      alerts: relevantAlerts,
    }
  } catch {
    return null
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export async function fetchAllSensorData(lat: number, lng: number, waterBodyType = 'Unknown water body'): Promise<SensorBundle> {
  const type = waterBodyType.toLowerCase()
  const isGreatLake = type.includes('great lake')
  const isLake = type.includes('lake') || type.includes('reservoir')
  const isRiver = type.includes('river') || type.includes('stream')
  const isSaltwater = type.includes('saltwater') || type.includes('coastal')
  const isPond = type.includes('pond')

  // Source routing by water body type:
  // Great Lakes  → NDBC buoys + CO-OPS stations + GLERL satellite temp
  // Lake/Reservoir → USGS lake gauges + CO-OPS
  // River/Stream → USGS river gauges (wider box) + NWPS forecasts
  // Saltwater    → NDBC + CO-OPS
  // Pond/Unknown → USGS river gauges (best-effort)
  // All types    → NWS active weather alerts

  const promises: Promise<SensorReading | null>[] = []

  if (isGreatLake) {
    promises.push(fetchNDBC(lat, lng))
    promises.push(fetchCOOPS(lat, lng))
    promises.push(fetchGLERL(lat, lng))
  } else if (isSaltwater) {
    promises.push(fetchNDBC(lat, lng))
    promises.push(fetchCOOPS(lat, lng))
  } else if (isLake) {
    promises.push(fetchUSGS(lat, lng, 'LK'))
    promises.push(fetchCOOPS(lat, lng))
  } else if (isRiver) {
    promises.push(fetchUSGS(lat, lng, 'ST'))
    promises.push(fetchNWPS(lat, lng))
  } else if (isPond) {
    promises.push(fetchUSGS(lat, lng, 'ST'))
  } else {
    promises.push(fetchUSGS(lat, lng, 'ST'))
    promises.push(fetchCOOPS(lat, lng))
  }

  // NWS alerts for every water body type
  promises.push(fetchNWSAlerts(lat, lng))

  const results = await Promise.allSettled(promises)
  const readings = results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((r): r is SensorReading => r !== null)

  return {
    readings,
    hasRealData: readings.length > 0,
  }
}
