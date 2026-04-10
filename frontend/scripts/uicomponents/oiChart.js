
export let oiChart = null;
export let oiChangeChart = null;
export function initOIChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (oiChart) oiChart.dispose();

    oiChart = echarts.init(el);

    oiChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },
        legend: { data: ["Call OI", "Put OI"] },

        xAxis: {
            type: "category",
            name: "Strike"
        },

        yAxis: {
            type: "value",
            name: "OI"
        },

        series: [
            { name: "Call OI", type: "bar", data: [] },
            { name: "Put OI", type: "bar", data: [] }
        ]
    });
}
export function renderOI(rows, currentSpot) {
    if (!oiChart || !rows) return;

    const spot = currentSpot;
    const range = spot * 0.20;

    const filtered = rows.filter(r =>
        !spot || Math.abs(r.strike - spot) <= range
    );

    const strikes = filtered.map(r => r.strike);

    const callOI = filtered.map(r => r.ce_oi);
    const putOI = filtered.map(r => r.pe_oi);

    oiChart.setOption({
        xAxis: { data: strikes },
        series: [
            { name: "Call OI", data: callOI },
            { name: "Put OI", data: putOI }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}
export function initOIChangeChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (oiChangeChart) oiChangeChart.dispose();

    oiChangeChart = echarts.init(el);

    oiChangeChart.setOption({
        backgroundColor: "#111",
        tooltip: { trigger: "axis" },
        legend: { data: ["Call del-OI", "Put del-OI"] },

        xAxis: {
            type: "category",
            name: "Strike"
        },

        yAxis: {
            type: "value",
            name: "del-OI"
        },

        series: [
            { name: "Call del-OI", type: "bar", data: [] },
            { name: "Put del-OI", type: "bar", data: [] }
        ]
    });
}

export function renderOIChange(rows, currentSpot) {
    if (!oiChangeChart || !rows) return;

    const spot = currentSpot;
    const range = spot * 0.20;

    const filtered = rows.filter(r =>
        !spot || Math.abs(r.strike - spot) <= range
    );

    const strikes = filtered.map(r => r.strike);

    const callChange = filtered.map(r => r.ce_oi_change);
    const putChange = filtered.map(r => r.pe_oi_change);

    oiChangeChart.setOption({
        xAxis: { data: strikes },
        series: [
            { name: "Call del-OI", data: callChange },
            { name: "Put del-OI", data: putChange }
        ],
        dataZoom: [
            { type: 'inside' },
            { type: 'slider', height: 25, bottom: 20 }
        ],
    });
}