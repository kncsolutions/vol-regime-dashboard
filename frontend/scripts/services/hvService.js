export function computeHVFromSpotPrevClose(spot, prevClose, currentTimestamp, marketOpenTimestamp) {
    console.log('spot, prevClose, currentTimestamp, marketOpenTimestamp', spot, prevClose, currentTimestamp, marketOpenTimestamp)

    if (!spot || !prevClose || spot <= 0 || prevClose <= 0) return null
    console.log('here')

    // =========================
    // 1. LOG RETURN
    // =========================
    const r = Math.log(spot / prevClose)

    // =========================
    // 2. TIME FRACTION
    // =========================
    const elapsedMs = currentTimestamp - marketOpenTimestamp

    if (!elapsedMs || elapsedMs <= 0) return null

    const elapsedSeconds = elapsedMs / 1000

    // Indian market ~ 6.25 hours
    const SECONDS_PER_DAY = 6.25 * 3600

    const t = elapsedSeconds / SECONDS_PER_DAY

    if (t <= 0) return null

    // =========================
    // 3. ANNUALIZED HV
    // =========================
    const hv = Math.abs(r) / Math.sqrt(t) * Math.sqrt(252)

    return hv * 100
}