export interface SensorReading {
  source: 'NOAA NDBC' | 'USGS' | 'NOAA CO-OPS' | 'NOAA NWPS' | 'NOAA GLERL' | 'NWS Alerts'
  stationName: string
  stationId: string
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

function parseMMVal(v: string | undefined): string | undefined {
  if (!v) return undefined
  return v && v !== 'MM' && v !== 'N/A' && v !== '9999' && v !== '999' && v !== '99.00' && v !== 'null' ? v : undefined
}

function nwpsStatusLabel(category: string): string {
  const map: Record<string, string> = {
    'no_flooding': 'Normal', 'action': 'Near Action Stage', 'minor': 'Minor Flood',
    'moderate': 'Moderate Flood', 'major': 'Major Flood', 'record': 'Record Flood',
  }
  return map[category] || category
}

// ─── NOAA NDBC ────────────────────────────────────────────────────────────────
// Uses latest_obs.txt — a single file with current readings from ALL active buoys
// worldwide. One HTTP request instead of N+1 individual fetches.
//
// latest_obs.txt column layout (0-indexed):
// 0:STN  1:LAT  2:LON  3:YYYY 4:MM 5:DD 6:hh 7:mm
// 8:WDIR 9:WSPD 10:GST 11:WVHT 12:DPD 13:APD 14:MWD
// 15:PRES 16:PTDY 17:ATMP 18:WTMP 19:DEWP 20:VIS 21:TIDE
async function fetchNDBCBuoys(lat: number, lng: number, max = 1): Promise<SensorReading[]> {
  try {
    const res = await fetch(
      'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt',
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return []
    const text = await res.text()

    type Candidate = {
      id: string; lat: number; lng: number; dist: number
      wtmp?: string; wvht?: string; dpd?: string; wspd?: string; wdir?: string
    }
    const candidates: Candidate[] = []

    for (const line of text.split('\n')) {
      if (line.startsWith('#') || !line.trim()) continue
      const p = line.trim().split(/\s+/)
      if (p.length < 19) continue
      const bLat = parseFloat(p[1])
      const bLng = parseFloat(p[2])
      if (isNaN(bLat) || isNaN(bLng)) continue

      const wtmp = parseMMVal(p[18])  // water temp °C
      const wvht = parseMMVal(p[11])  // wave height m
      const wspd = parseMMVal(p[9])   // wind speed m/s
      if (!wtmp && !wvht && !wspd) continue  // skip if nothing useful

      candidates.push({
        id: p[0],
        lat: bLat,
        lng: bLng,
        dist: haversine(lat, lng, bLat, bLng),
        wtmp,
        wvht,
        dpd: parseMMVal(p[12]),
        wspd,
        wdir: parseMMVal(p[8]),
      })
    }

    candidates.sort((a, b) => a.dist - b.dist)

    // For station names, fetch the XML (cached 1h so not a bottleneck after first load)
    const nameMap = new Map<string, string>()
    try {
      const xmlRes = await fetch(
        'https://www.ndbc.noaa.gov/data/stations/active_stations.xml',
        { next: { revalidate: 3600 } }
      )
      const xml = await xmlRes.text()
      const re = /id="([^"]+)"[^>]*name="([^"]+)"/g
      let m: RegExpExecArray | null
      while ((m = re.exec(xml)) !== null) nameMap.set(m[1].toUpperCase(), m[2])
    } catch { /* names fall back to ID */ }

    return candidates.slice(0, max).map(c => ({
      source: 'NOAA NDBC' as const,
      stationName: nameMap.get(c.id.toUpperCase()) || `Buoy ${c.id}`,
      stationId: c.id,
      distanceMiles: Math.round(c.dist),
      url: `https://www.ndbc.noaa.gov/station_page.php?station=${c.id.toLowerCase()}`,
      waterTemp: c.wtmp ? `${Math.round(parseFloat(c.wtmp) * 9 / 5 + 32)}°F` : undefined,
      waveHeight: c.wvht ? `${(parseFloat(c.wvht) * 3.281).toFixed(1)} ft` : undefined,
      wavePeriod: c.dpd ? `${c.dpd}s` : undefined,
      windSpeed: c.wspd ? `${Math.round(parseFloat(c.wspd) * 2.237)} mph` : undefined,
      windDirection: c.wdir,
    }))
  } catch (e) {
    console.error('NDBC error:', e)
    return []
  }
}

// ─── NOAA GLERL ───────────────────────────────────────────────────────────────
// Satellite-derived Great Lakes surface temperature via GLERL CoastWatch ERDDAP.
// Fixes vs previous version:
//   - Correct base URL: apps.glerl.noaa.gov (coastwatch.glerl.noaa.gov redirects away)
//   - Correct dataset: GLSEA_ACSPO_GCS (glsea4 doesn't exist on this server)
//   - Correct variable name: sst (not surface_temperature)
async function fetchGLERL(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const url =
      `https://apps.glerl.noaa.gov/erddap/griddap/GLSEA_ACSPO_GCS.json` +
      `?sst[(last)][(${lat.toFixed(4)})][(${lng.toFixed(4)})]`

    const res = await fetch(url, { next: { revalidate: 21600 } }) // 6h — daily satellite product
    if (!res.ok) {
      console.error('GLERL error:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    const rows = data?.table?.rows
    if (!rows?.length) return null

    const cols: string[] = data.table.columnNames
    const sstIdx = cols.indexOf('sst')
    if (sstIdx < 0) return null

    const tempC = rows[0][sstIdx]
    if (tempC == null || isNaN(parseFloat(tempC))) return null

    const tempF = Math.round(parseFloat(tempC) * 9 / 5 + 32)
    return {
      source: 'NOAA GLERL',
      stationName: 'Great Lakes Surface Temp (GLSEA Satellite)',
      stationId: 'GLSEA_ACSPO_GCS',
      distanceMiles: 0,
      url: 'https://coastwatch.glerl.noaa.gov/glsea/glsea.html',
      waterTemp: `${tempF}°F`,
    }
  } catch (e) {
    console.error('GLERL error:', e)
    return null
  }
}

// ─── USGS Water Services ───────────────────────────────────────────────────────
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
      if (paramCode === '00010') waterTemp = `${Math.round(parseFloat(latest) * 9 / 5 + 32)}°F`
      else if (paramCode === '00060') flowRate = `${Math.round(parseFloat(latest)).toLocaleString()} cfs`
      else if (paramCode === '00065') gaugeHeight = `${parseFloat(latest).toFixed(2)} ft`
    }

    if (!waterTemp && !flowRate && !gaugeHeight) return null

    return {
      source: 'USGS',
      stationName: siteName,
      stationId: siteCode,
      distanceMiles: Math.round(best.dist),
      url: `https://waterdata.usgs.gov/monitoring-location/${siteCode}/`,
      waterTemp, flowRate, gaugeHeight,
    }
  } catch (e) {
    console.error('USGS error:', e)
    return null
  }
}

// ─── NOAA CO-OPS ──────────────────────────────────────────────────────────────
// Key fixes:
// 1. Use date=latest instead of begin/end time range (simpler, avoids UTC formatting bugs)
// 2. Great Lakes stations use datum=IGLD (not MLLW). Detect via greatlakes field.
// 3. Water temp is only available at a subset of stations — we try the 3 nearest
//    and return the first one that has actual data for either product.
async function fetchCOOPS(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const stationsRes = await fetch(
      'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels&units=english',
      { next: { revalidate: 3600 } }
    )
    const stationsData = await stationsRes.json()
    const stations: Array<{ id: string; name: string; lat: number; lng: number; greatlakes: boolean }> =
      (stationsData?.stations || [])
        .map((s: { id: string; name: string; lat: number; lng: number; greatlakes?: boolean }) => ({
          id: s.id,
          name: s.name,
          lat: parseFloat(String(s.lat)),
          lng: parseFloat(String(s.lng)),
          greatlakes: s.greatlakes === true,
        }))
        .filter((s: { lat: number; lng: number }) => !isNaN(s.lat) && !isNaN(s.lng))

    // Sort by distance, try up to 5 nearest stations until we get real data
    const sorted = [...stations]
      .map(s => ({ ...s, dist: haversine(lat, lng, s.lat, s.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)

    for (const station of sorted) {
      const datum = station.greatlakes ? 'datum=IGLD&' : 'datum=MLLW&'
      const base = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${station.id}&date=latest&time_zone=GMT&units=english&format=json`

      const [wtRes, wlRes] = await Promise.allSettled([
        fetch(`${base}&product=water_temperature`),
        fetch(`${base}&product=water_level&${datum}`),
      ])

      let waterTemp: string | undefined
      let waterLevel: string | undefined

      if (wtRes.status === 'fulfilled') {
        const d = await wtRes.value.json()
        const v = d?.data?.[d.data.length - 1]?.v
        if (v && v !== '-' && !d.error) waterTemp = `${parseFloat(v).toFixed(1)}°F`
      }
      if (wlRes.status === 'fulfilled') {
        const d = await wlRes.value.json()
        const v = d?.data?.[d.data.length - 1]?.v
        if (v && v !== '-' && !d.error) waterLevel = `${parseFloat(v).toFixed(2)} ft`
      }

      if (!waterTemp && !waterLevel) continue  // try next station

      return {
        source: 'NOAA CO-OPS',
        stationName: station.name,
        stationId: station.id,
        distanceMiles: Math.round(station.dist),
        url: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${station.id}`,
        waterTemp,
        waterLevel,
      }
    }
    return null
  } catch (e) {
    console.error('CO-OPS error:', e)
    return null
  }
}

// ─── NOAA NWPS ────────────────────────────────────────────────────────────────
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
      if (lid && (!best || dist < best.dist)) best = { lid, name, dist }
    }
    if (!best) return null

    const nwpsRes = await fetch(`https://api.water.noaa.gov/nwps/v1/gauges/${best.lid}`, { next: { revalidate: 1800 } })
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
      url: `https://water.noaa.gov/gauges/${best.lid.toLowerCase()}`,
      currentStage, actionStage, floodStage, moderateFloodStage, majorFloodStage, riverStatus, forecastStage, forecastTrend,
    }
  } catch (e) {
    console.error('NWPS error:', e)
    return null
  }
}

// ─── NWS Alerts ───────────────────────────────────────────────────────────────
const FISHING_ALERT_EVENTS = new Set([
  'Flood Warning', 'Flash Flood Warning', 'Flash Flood Watch', 'Flood Advisory', 'Flood Watch',
  'Small Craft Advisory', 'Small Craft Advisory for Hazardous Seas', 'Special Marine Warning',
  'High Wind Warning', 'High Wind Watch', 'Wind Advisory',
  'Lake Wind Advisory', 'Lakeshore Flood Advisory', 'Lakeshore Flood Warning',
  'Coastal Flood Advisory', 'Coastal Flood Warning',
  'Dense Fog Advisory', 'Rip Current Statement', 'Beach Hazards Statement',
  'Winter Storm Warning', 'Ice Storm Warning', 'Blizzard Warning',
  'Severe Thunderstorm Warning', 'Tornado Warning',
])

async function fetchNWSAlerts(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`,
      { headers: { 'User-Agent': 'CastIQ/1.0 (fishing conditions app)' }, next: { revalidate: 900 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const alerts = (data?.features || [])
      .filter((f: { properties: { event: string } }) => FISHING_ALERT_EVENTS.has(f.properties?.event))
      .map((f: { properties: { event: string } }) => f.properties.event)
      .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)

    if (!alerts.length) return null
    return {
      source: 'NWS Alerts',
      stationName: 'National Weather Service',
      stationId: 'NWS',
      distanceMiles: 0,
      url: `https://forecast.weather.gov/MapClick.php?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`,
      alerts,
    }
  } catch (e) {
    console.error('NWS Alerts error:', e)
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

  const all: SensorReading[] = []
  const push = (r: SensorReading | null) => { if (r) all.push(r) }
  const pushAll = (arr: SensorReading[]) => all.push(...arr)

  if (isGreatLake) {
    const [ndbcArr, coops, glerl, alerts] = await Promise.allSettled([
      fetchNDBCBuoys(lat, lng, 3),   // up to 3 nearest buoys
      fetchCOOPS(lat, lng),
      fetchGLERL(lat, lng),
      fetchNWSAlerts(lat, lng),
    ])
    if (ndbcArr.status === 'fulfilled') pushAll(ndbcArr.value)
    if (coops.status === 'fulfilled') push(coops.value)
    if (glerl.status === 'fulfilled') push(glerl.value)
    if (alerts.status === 'fulfilled') push(alerts.value)

  } else if (isSaltwater) {
    const [ndbcArr, coops, alerts] = await Promise.allSettled([
      fetchNDBCBuoys(lat, lng, 2),
      fetchCOOPS(lat, lng),
      fetchNWSAlerts(lat, lng),
    ])
    if (ndbcArr.status === 'fulfilled') pushAll(ndbcArr.value)
    if (coops.status === 'fulfilled') push(coops.value)
    if (alerts.status === 'fulfilled') push(alerts.value)

  } else if (isLake) {
    const [usgs, coops, alerts] = await Promise.allSettled([
      fetchUSGS(lat, lng, 'LK'),
      fetchCOOPS(lat, lng),
      fetchNWSAlerts(lat, lng),
    ])
    if (usgs.status === 'fulfilled') push(usgs.value)
    if (coops.status === 'fulfilled') push(coops.value)
    if (alerts.status === 'fulfilled') push(alerts.value)

  } else if (isRiver) {
    const [usgs, nwps, alerts] = await Promise.allSettled([
      fetchUSGS(lat, lng, 'ST'),
      fetchNWPS(lat, lng),
      fetchNWSAlerts(lat, lng),
    ])
    if (usgs.status === 'fulfilled') push(usgs.value)
    if (nwps.status === 'fulfilled') push(nwps.value)
    if (alerts.status === 'fulfilled') push(alerts.value)

  } else if (isPond) {
    const [usgs, alerts] = await Promise.allSettled([
      fetchUSGS(lat, lng, 'ST'),
      fetchNWSAlerts(lat, lng),
    ])
    if (usgs.status === 'fulfilled') push(usgs.value)
    if (alerts.status === 'fulfilled') push(alerts.value)

  } else {
    const [usgs, coops, alerts] = await Promise.allSettled([
      fetchUSGS(lat, lng, 'ST'),
      fetchCOOPS(lat, lng),
      fetchNWSAlerts(lat, lng),
    ])
    if (usgs.status === 'fulfilled') push(usgs.value)
    if (coops.status === 'fulfilled') push(coops.value)
    if (alerts.status === 'fulfilled') push(alerts.value)
  }

  return { readings: all, hasRealData: all.length > 0 }
}
