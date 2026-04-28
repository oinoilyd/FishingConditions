import { NextRequest, NextResponse } from 'next/server'

function scorePoint(current: Record<string, number>, pressureTrend: number): number {
  let total = 0

  if (pressureTrend < -2) total += 22
  else if (pressureTrend < -0.5) total += 25
  else if (Math.abs(pressureTrend) <= 0.5) total += 15
  else if (pressureTrend < 2) total += 10
  else total += 5

  const wind = current.wind_speed_10m
  if (wind >= 5 && wind <= 15) total += 20
  else if (wind < 5) total += 12
  else if (wind <= 20) total += 10
  else if (wind <= 30) total += 5

  const clouds = current.cloud_cover
  if (clouds >= 75) total += 15
  else if (clouds >= 25) total += 12
  else total += 8

  const code = current.weather_code
  if (code <= 3) total += 10
  else if (code <= 48) total += 6
  else if (code <= 57) total += 14
  else if (code <= 67) total += 12
  else if (code <= 82) total += 8
  else total += 2

  const temp = current.temperature_2m
  if (temp >= 55 && temp <= 72) total += 10
  else if ((temp >= 45 && temp < 55) || (temp > 72 && temp <= 80)) total += 7
  else if ((temp >= 35 && temp < 45) || (temp > 80 && temp <= 90)) total += 4
  else total += 2

  return Math.min(10, Math.max(1, Math.round(total / 10)))
}

export async function POST(req: NextRequest) {
  try {
    const { north, south, east, west } = await req.json()

    // 5x5 grid across the map bounds
    const rows = 5
    const cols = 5
    const points: Array<{ lat: number; lng: number }> = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        points.push({
          lat: south + (north - south) * (r / (rows - 1)),
          lng: west + (east - west) * (c / (cols - 1)),
        })
      }
    }

    const results = await Promise.allSettled(
      points.map(async ({ lat, lng }) => {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,cloud_cover,surface_pressure,weather_code&hourly=surface_pressure&past_hours=3&forecast_hours=1&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto`,
          { next: { revalidate: 1800 } }
        )
        const data = await res.json()
        const current = data.current
        const hourlyPressure: number[] = data.hourly?.surface_pressure || []
        const pressureTrend = hourlyPressure.length >= 2
          ? hourlyPressure[hourlyPressure.length - 1] - hourlyPressure[0]
          : 0
        return { lat, lng, score: scorePoint(current, pressureTrend) }
      })
    )

    const scores = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean)

    return NextResponse.json({ scores })
  } catch (error) {
    console.error('Scores error:', error)
    return NextResponse.json({ error: 'Failed to score conditions' }, { status: 500 })
  }
}
