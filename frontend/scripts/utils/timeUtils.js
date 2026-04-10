export function toISTDate(ts) {
    const date = new Date(ts * 1000)

    return date.toLocaleDateString("en-CA", {   // YYYY-MM-DD format
        timeZone: "Asia/Kolkata"
    })
}
export function toISTDateTimeIntraday(ts) {
    // If timestamp is in seconds → convert to ms
    if (ts < 1e12) ts = ts * 1000;

    const date = new Date(ts);

    // Convert to IST using Intl
    const options = {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    };

    const parts = new Intl.DateTimeFormat("en-GB", options)
        .formatToParts(date);

    const get = (type) => parts.find(p => p.type === type).value;

    return `${get("year")}-${get("month")}-${get("day")} ` +
           `${get("hour")}:${get("minute")}:${get("second")}`;
}

export function toChartDate(ts) {
    if (ts < 1e12) ts *= 1000;

    // IMPORTANT: use UTC ISO, not IST
    return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD
}