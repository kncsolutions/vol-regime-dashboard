export let vegaChart = null;
export let vegaSkewChart = null;

export function initVegaChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (vegaChart) {
        vegaChart.dispose();
    }

    vegaChart = echarts.init(el);

    vegaChart.setOption({
        backgroundColor: "#111",
        grid: { left: 50, right: 20, top: 10, bottom: 30 },

        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            textStyle: { color: "#fff" }
        },

        xAxis: {
            type: "category",
            name: "Strike",
            axisLine: { lineStyle: { color: "#888" } },
            axisLabel: { color: "#AAA" }
        },

        yAxis: {
            type: "value",
            name: "Vega",
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },

        series: [{
            type: "bar",
            data: []
        }]
    });
}



export function initVegaSkewChart(panel) {
    const el = document.getElementById(panel);
    if (!el) return;

    if (vegaSkewChart) {
        vegaSkewChart.dispose();
    }

    vegaSkewChart = echarts.init(el);

    vegaSkewChart.setOption({
        backgroundColor: "#111",
        grid: { left: 50, right: 20, top: 10, bottom: 30 },

        tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
            backgroundColor: "#222",
            textStyle: { color: "#fff" }
        },

        xAxis: {
            type: "category",
            name: "Strike",
            axisLine: { lineStyle: { color: "#888" } },
            axisLabel: { color: "#AAA" }
        },

        yAxis: {
            type: "value",
            name: "Vega",
            axisLine: { lineStyle: { color: "#888" } },
            splitLine: { lineStyle: { color: "#222" } }
        },

        series: [{
            type: "line",
            data: []
        }]
    });
}




export function renderVegaLadder(vegaLadder, currentSpot) {

    if (!vegaChart || !vegaLadder) return;

    const spot = currentSpot;

    // 🔥 focus near spot
    const range = currentSpot * 0.20; // 3%

        const filtered = vegaLadder.filter(v =>
            !spot || Math.abs(v.strike - spot) <= range
        );

    // 🔥 sort by strike
    filtered.sort((a, b) => a.strike - b.strike);

    const strikes = filtered.map(v => v.strike);

    const data = filtered.map(v => ({
        value: v.vega,
        itemStyle: {
            color: v.vega > 0 ? "#ffa500" : "#00ffcc"
        }
    }));

    vegaChart.setOption({
        xAxis: {
            data: strikes
        },
        series: [{
            data: data
        }],
        grid: {
          left: 40,
          right: 20,
          top: 20,
          bottom: 80   // 👈 increase this
        },
        dataZoom: [{type: "inside"}, {type: "slider",height: 30,
    bottom: 10 } ]
    });
}




export function renderVegaSkew(vegaSkew, currentSpot) {

    if (!vegaSkewChart || !vegaSkew) return;

    const spot = currentSpot;

    // 🔥 focus near spot
    const range = currentSpot * 0.08; // 3%

        const filtered = vegaSkew.filter(v =>
            !spot || Math.abs(v.strike - spot) <= range
        );

    // 🔥 sort by strike
    filtered.sort((a, b) => a.strike - b.strike);

    const strikes = filtered.map(v => v.strike);

    const data = filtered.map(v => ({
        value: v.vega,
        itemStyle: {
            color: v.vega > 0 ? "#ffa500" : "#00ffcc"
        }
    }));

    vegaSkewChart.setOption({
        xAxis: {
            data: strikes
        },
        series: [{
            data: data
        }],
        grid: {
          left: 40,
          right: 20,
          top: 20,
          bottom: 80   // 👈 increase this
        },
        dataZoom: [{type: "inside"}, {type: "slider",height: 30,
    bottom: 10 } ]
    });
}