export interface SensorReading {
  source: 'NOAA NDBC' | 'USGS' | 'NOAA CO-OPS' | 'NOAA NWPS'
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
  riverStatus?: string       // Normal / Near Action / Action / Minor Flood / Moderate Flood / Major Flood / Record
  forecastStage?: string     // predicted stage (next 6-12h)
  forecastTrend?: string     // Rising / Falling / Steady
  // Wind (buoys)
  windSpeed?: string
  windDirection?: string
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

// NOAA NDBC buoys — wave height, water temp, wind from physical buoys
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
      if (dist < 200 && (!best || dist < best.dist)) {
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

    if (!waterTemp && !waveHeight) return null

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

// USGS — river flow rate, gauge height, water temp
async function fetchUSGS(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const pad = 0.75
    const bbox = `${(lng - pad).toFixed(3)},${(lat - pad).toFixed(3)},${(lng + pad).toFixed(3)},${(lat + pad).toFixed(3)}`
    const res = await fetch(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00010,00060,00065&period=PT2H&siteType=ST&siteStatus=active`,
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

// NOAA CO-OPS — Great Lakes + coastal water temp and levels
async function fetchCOOPS(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const stationsRes = await fetch(
      'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels&units=english',
      { next: { revalidate: 3600 } }
    )
    const stationsData = await stationsRes.json()
    const stations = stationsData?.stations || []

    let best: { id: string; name: string; dist: number } | null = null
    for (const s of stations) {
      const dist = haversine(lat, lng, parseFloat(s.lat), parseFloat(s.lng))
      if (dist < 150 && (!best || dist < best.dist)) {
        best = { id: s.id, name: s.name, dist }
      }
    }
    if (!best) return null

    const now = new Date()
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const end = fmt(now)
    const start = fmt(new Date(now.getTime() - 3600000))

    const [tempRes, levelRes] = await Promise.allSettled([
      fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&station=${best.id}&begin_date=${start.replace(' ', '%20')}&end_date=${end.replace(' ', '%20')}&time_zone=GMT&units=english&format=json`),
      fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&station=${best.id}&begin_date=${start.replace(' ', '%20')}&end_date=${end.replace(' ', '%20')}&time_zone=GMT&units=english&datum=MLLW&format=json`),
    ])

    let waterTemp: string | undefined
    let waterLevel: string | undefined

    if (tempRes.status === 'fulfilled') {
      const d = await tempRes.value.json()
      const latest = d?.data?.[d.data.length - 1]?.v
      if (latest && latest !== '-') waterTemp = `${parseFloat(latest).toFixed(1)}°F`
    }

    if (levelRes.status === 'fulfilled') {
      const d = await levelRes.value.json()
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

// NOAA NWPS — river stage, flood thresholds, status, and forecast
async function fetchNWPS(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const pad = 0.75
    const bbox = `${(lng - pad).toFixed(3)},${(lat - pad).toFixed(3)},${(lng + pad).toFixed(3)},${(lat + pad).toFixed(3)}`

    // Find nearest NWS forecast gauge via ArcGIS MapServer (supports bbox)
    const arcRes = await fetch(
      `https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/riv_gauges/MapServer/0/query?geometry=${bbox}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=*&f=json`,
      { next: { revalidate: 1800 } }
    )
    const arcData = await arcRes.json()
    const features = arcData?.features || []
    if (!features.length) return null

    // Find nearest feature
    let best: { lid: string; name: string; dist: number } | null = null
    for (const f of features) {
      const fLat = f.geometry?.y ?? f.attributes?.latitude ?? f.attributes?.lat
      const fLng = f.geometry?.x ?? f.attributes?.longitude ?? f.attributes?.lon
      if (!fLat || !fLng) continue
      const dist = haversine(lat, lng, fLat, fLng)
      const lid = f.attributes?.gaugeID || f.attributes?.lid || f.attributes?.STAID
      const name = f.attributes?.name || f.attributes?.STANAME || lid
      if (dist < 100 && lid && (!best || dist < best.dist)) {
        best = { lid, name, dist }
      }
    }
    if (!best) return null

    // Get full gauge details from NWPS API
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

    // Get next 12h forecast peak
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

export async function fetchAllSensorData(lat: number, lng: number): Promise<SensorBundle> {
  const [ndbc, usgs, coops, nwps] = await Promise.allSettled([
    fetchNDBC(lat, lng),
    fetchUSGS(lat, lng),
    fetchCOOPS(lat, lng),
    fetchNWPS(lat, lng),
  ])

  const readings = [
    ndbc.status === 'fulfilled' ? ndbc.value : null,
    usgs.status === 'fulfilled' ? usgs.value : null,
    coops.status === 'fulfilled' ? coops.value : null,
    nwps.status === 'fulfilled' ? nwps.value : null,
  ].filter((r): r is SensorReading => r !== null)

  return {
    readings,
    hasRealData: readings.length > 0,
  }
}
