export interface SensorReading {
  source: 'NOAA NDBC' | 'USGS' | 'NOAA CO-OPS'
  stationName: string
  stationId: string
  distanceMiles: number
  waterTemp?: string
  waveHeight?: string
  wavePeriod?: string
  waterLevel?: string
  flowRate?: string
  gaugeHeight?: string
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

// NOAA NDBC buoys — wave height, water temp, wind from physical buoys
async function fetchNDBC(lat: number, lng: number): Promise<SensorReading | null> {
  try {
    const stationsRes = await fetch(
      'https://www.ndbc.noaa.gov/data/stations/active_stations.xml',
      { next: { revalidate: 3600 } }
    )
    const xml = await stationsRes.text()

    // Parse station entries: <station id="..." lat="..." lon="..." name="..." .../>
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

    // Find nearest site
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

export async function fetchAllSensorData(lat: number, lng: number): Promise<SensorBundle> {
  const [ndbc, usgs, coops] = await Promise.allSettled([
    fetchNDBC(lat, lng),
    fetchUSGS(lat, lng),
    fetchCOOPS(lat, lng),
  ])

  const readings = [
    ndbc.status === 'fulfilled' ? ndbc.value : null,
    usgs.status === 'fulfilled' ? usgs.value : null,
    coops.status === 'fulfilled' ? coops.value : null,
  ].filter((r): r is SensorReading => r !== null)

  return {
    readings,
    hasRealData: readings.length > 0,
  }
}
