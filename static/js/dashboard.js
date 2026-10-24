/* ============ 销售数据可视化大屏 ============ */

/* ---------- 1. 1920x1080 自适应缩放 ---------- */
const DESIGN_W = 1920, DESIGN_H = 1080;
function fitScreen() {
    const scale = Math.min(innerWidth / DESIGN_W, innerHeight / DESIGN_H);
    document.getElementById("screen").style.transform =
        `translate(-50%, -50%) scale(${scale})`;
    Object.values(charts).forEach(c => c && c.resize());
}
addEventListener("resize", fitScreen);

/* ---------- 2. 通用工具 ---------- */
// 数字滚动动画（easeOutCubic）
function countUp(el, target, decimals = 0, duration = 1200) {
    const start = performance.now();
    (function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toLocaleString("zh-CN",
            { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        if (p < 1) requestAnimationFrame(tick);
    })(start);
}
const fmtWan = v => (v / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 }); // 元 -> 万元

// KPI 卡片配置：label / 单位 / 精度 / 取值 / 图标组（动态切换）
const KPI_CONFIG = [
    { label: "总销售额", unit: "万元", dec: 1, get: k => k.amount / 10000, icons: ["💵", "💰"] },
    { label: "总利润",   unit: "万元", dec: 1, get: k => k.profit / 10000, icons: ["📈", "💎"] },
    { label: "总销量",   unit: "件",   dec: 0, get: k => k.qty,           icons: ["📦", "🚚"] },
    { label: "利润率",   unit: "%",    dec: 1, get: k => k.margin,        icons: ["📊", "⚡"] },
    { label: "覆盖省份", unit: "个",   dec: 0, get: k => k.provinces,     icons: ["🗺", "🌏"] },
];
let kpiIconToggle = 0; // 图标切换计数器

/* ---------- 3. ECharts 实例管理 ---------- */
const charts = {};
function chart(id) {
    if (!charts[id]) {
        charts[id] = echarts.init(document.getElementById(id));
        // 记录鼠标悬停状态，供轮播高亮暂停判断
        charts[id].hovered = false;
        charts[id].on("mouseover", () => charts[id].hovered = true);
        charts[id].on("mouseout", () => charts[id].hovered = false);
    }
    return charts[id];
}

/* 省份 -> 中心坐标（用于地图涟漪散点） */
const COORDS = {
    "广东": [113.28, 23.13], "江苏": [118.80, 32.06], "山东": [117.02, 36.67],
    "浙江": [120.15, 30.28], "河南": [113.62, 34.75], "四川": [104.07, 30.67],
    "湖北": [114.31, 30.59], "湖南": [112.98, 28.19], "河北": [114.48, 38.03],
    "安徽": [117.28, 31.86], "福建": [119.30, 26.08], "陕西": [108.95, 34.27],
    "辽宁": [123.43, 41.80], "江西": [115.89, 28.68], "云南": [102.71, 25.04],
    "广西": [108.32, 22.82], "山西": [112.55, 37.87], "贵州": [106.71, 26.57],
    "重庆": [106.54, 29.59], "天津": [117.20, 39.13], "北京": [116.40, 39.90],
    "上海": [121.47, 31.23],
};

/* 中国地图 GeoJSON：本地加载一次 */
const geoReady = fetch("/static/geo/china.json")
    .then(r => r.json())
    .then(geo => { echarts.registerMap("china", geo); });

/* ---------- 4. 各区块渲染 ---------- */

/* KPI 核心指标（数字滚动 + 图标动态切换） */
function renderKPI(kpi) {
    kpiIconToggle ^= 1;
    document.getElementById("kpiRow").innerHTML = KPI_CONFIG.map((c, i) => `
        <div class="kpi-card">
            <div class="kpi-icon" style="animation-delay:${i * .3}s">${c.icons[kpiIconToggle]}</div>
            <div class="kpi-info">
                <div class="kpi-label">${c.label}</div>
                <div class="kpi-value"><span id="kpiNum${i}">0</span><span class="kpi-unit">${c.unit}</span></div>
            </div>
        </div>`).join("");
    KPI_CONFIG.forEach((c, i) =>
        countUp(document.getElementById(`kpiNum${i}`), c.get(kpi), c.dec));
}

/* 销售明细列表（复制两份实现无缝轮播，悬停暂停由 CSS 控制） */
function renderDetail(rows) {
    const item = r => `
        <li class="detail-list-item">
            <span>${r["日期"]}</span><span>${r["省份"]}</span>
            <span class="ellipsis">${r["产品"]}</span><span>${r["渠道"]}</span>
            <span class="amt">${r["销售额"].toLocaleString("zh-CN")}</span>
        </li>`;
    const html = rows.map(item).join("");
    document.getElementById("detailList").innerHTML = html + html;
}

/* 地区占比 & 渠道占比：玫瑰图（同一套渲染函数） */
function renderPie(id, data, colors) {
    chart(id).setOption({
        color: colors,
        tooltip: { trigger: "item", formatter: "{b}<br/>{c} 万元 ({d}%)" },
        legend: { bottom: 0, textStyle: { color: "#5b7a99", fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
        series: [{
            type: "pie",
            radius: ["32%", "62%"], center: ["50%", "44%"],
            roseType: "radius",
            itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
            label: { show: false },
            data: data.map(d => ({ name: d.name, value: +fmtWan(d.value) })),
        }],
    });
}

/* 饼图自动高亮轮播（图标/扇区动态切换效果），悬停图表时暂停 */
function pieAutoHighlight(id, data) {
    let idx = 0;
    clearInterval(chart(id)._hi);
    chart(id)._hi = setInterval(() => {
        if (chart(id).hovered) return;                   // 悬停时暂停切换
        data.forEach((_, i) => chart(id).dispatchAction({ type: "downplay", seriesIndex: 0, dataIndex: i }));
        chart(id).dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: idx });
        chart(id).dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: idx });
        idx = (idx + 1) % data.length;
    }, 2500);
}

/* 产品排行：横向渐变条形图 */
function renderProductBar(data) {
    const rows = [...data].reverse(); // 倒序让最大值在顶部
    chart("productBar").setOption({
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: p => `${p[0].name}<br/>${p[0].value} 万元` },
        grid: { left: 110, right: 40, top: 10, bottom: 22 },
        xAxis: { type: "value", axisLabel: { color: "#7d99b5", fontSize: 11 }, splitLine: { lineStyle: { color: "rgba(120,170,220,.2)" } } },
        yAxis: {
            type: "category", data: rows.map(d => d.name),
            axisLabel: { color: "#33557a", fontSize: 12 },
            axisLine: { show: false }, axisTick: { show: false },
        },
        series: [{
            type: "bar", barWidth: 14,
            data: rows.map(d => +fmtWan(d.value)),
            itemStyle: {
                borderRadius: 7,
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0,
                    [{ offset: 0, color: "#6db3f2" }, { offset: 1, color: "#2f6fd3" }]),
            },
            // 柱内百分比标签
            label: { show: true, position: "right", color: "#1663c7", fontSize: 11, fontFamily: "Consolas" },
        }],
        animationDuration: 1200,
    });
}

/* 月度趋势：柱（销售额）+ 折线（利润）双系列 */
function renderTrend(monthly) {
    chart("trendChart").setOption({
        tooltip: { trigger: "axis" },
        legend: { top: 0, textStyle: { color: "#5b7a99" }, itemWidth: 14, itemHeight: 8 },
        grid: { left: 60, right: 30, top: 34, bottom: 26 },
        xAxis: {
            type: "category", data: monthly.map(m => m.month),
            axisLabel: { color: "#7d99b5" }, axisLine: { lineStyle: { color: "#b9d4ee" } },
        },
        yAxis: {
            type: "value", name: "万元", nameTextStyle: { color: "#7d99b5" },
            axisLabel: { color: "#7d99b5" }, splitLine: { lineStyle: { color: "rgba(120,170,220,.25)" } },
        },
        series: [
            {
                name: "销售额", type: "bar", barWidth: 22,
                data: monthly.map(m => +fmtWan(m.amount)),
                itemStyle: {
                    borderRadius: [6, 6, 0, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1,
                        [{ offset: 0, color: "#5aa5f0" }, { offset: 1, color: "#b3d9ff" }]),
                },
            },
            {
                name: "利润", type: "line", smooth: true,
                data: monthly.map(m => +fmtWan(m.profit)),
                lineStyle: { width: 3, color: "#35c2a0" },
                itemStyle: { color: "#35c2a0" },
                areaStyle: { color: "rgba(53,194,160,.12)" },
            },
        ],
        animationDuration: 1200,
    });
}

/* 全国销售地图：省份填色 + Top5 涟漪散点 */
function renderMap(mapData) {
    const top5 = [...mapData].sort((a, b) => b.value - a.value).slice(0, 5)
        .filter(d => COORDS[d.name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, "")])
        .map(d => {
            const short = d.name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, "");
            return { name: d.name, value: [...COORDS[short], +fmtWan(d.value)] };
        });
    geoReady.then(() => chart("chinaMap").setOption({
        tooltip: { formatter: p => p.value ? `${p.name}<br/>销售额 ${fmtWan(p.value)} 万元` : p.name },
        visualMap: {
            min: 0, max: Math.max(...mapData.map(d => d.value)),
            left: 16, bottom: 16,
            text: ["高", "低"], textTextStyle: { color: "#5b7a99" },
            inRange: { color: ["#e3f1ff", "#a8d1f5", "#5aa5f0", "#2f6fd3", "#1d5ab8"] },
            textStyle: { color: "#5b7a99" },
        },
        series: [
            {
                type: "map", map: "china", roam: false,
                itemStyle: { borderColor: "#fff", borderWidth: 1, shadowColor: "rgba(70,130,200,.3)", shadowBlur: 10 },
                emphasis: { label: { color: "#0d3b73" }, itemStyle: { areaColor: "#8fc3f7" } },
                data: mapData.map(d => ({ name: d.name, value: d.value })),
            },
            {
                type: "effectScatter", coordinateSystem: "geo", zlevel: 2,
                symbolSize: v => 8 + v[2] / 60,   // 涟漪散点大小随销售额变化
                rippleEffect: { brushType: "stroke", scale: 3.2 },
                itemStyle: { color: "#ff8c42", shadowBlur: 8 },
                label: { show: true, formatter: "{b}", position: "right", color: "#0d3b73", fontSize: 12 },
                data: top5,
            },
        ],
        animationDuration: 1200,
    }));
}

/* 利润进度条（CSS transition 完成进度动画） */
function renderProfitRate(list) {
    const wrap = document.getElementById("profitProgress");
    wrap.innerHTML = list.slice(0, 6).map(p => `
        <div class="progress-item">
            <div class="progress-head"><span>${p.name}</span><b>${p.rate}%</b></div>
            <div class="progress-track"><div class="progress-fill" data-w="${p.rate}"></div></div>
        </div>`).join("");
    // 下一帧再设宽度，触发 CSS 过渡动画
    requestAnimationFrame(() =>
        requestAnimationFrame(() =>
            wrap.querySelectorAll(".progress-fill").forEach(el => el.style.width = el.dataset.w + "%")));
}

/* 地区热榜：排名徽章 + 进度条（复用轮播滚动） */
function renderHotList(list) {
    const max = list[0].value;
    const item = (d, i) => `
        <li class="hot-list-item">
            <span class="rank-badge rank-${i + 1}">${i + 1}</span>
            <span class="hot-name">${d.name}</span>
            <span class="hot-bar"><span class="hot-bar-fill" style="width:${(d.value / max * 100).toFixed(1)}%"></span></span>
            <span class="hot-val">${fmtWan(d.value)} 万</span>
        </li>`;
    const html = list.map(item).join("");
    document.getElementById("hotList").innerHTML = html + html;
}

/* ---------- 5. 顶部时钟 ---------- */
function tickClock() {
    const now = new Date();
    const p = n => String(n).padStart(2, "0");
    document.getElementById("headerTime").textContent =
        `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}
setInterval(tickClock, 1000); tickClock();

/* ---------- 6. 数据加载与定时刷新 ---------- */
async function loadData() {
    const data = await (await fetch("/api/dashboard")).json();
    document.getElementById("updateTime").textContent = `数据更新 ${data.updateTime}`;
    renderKPI(data.kpi);
    renderDetail(data.detail);
    renderPie("provincePie", data.provinceTop, ["#2f6fd3", "#4a90e2", "#6db3f2", "#35c2a0", "#7cc4ff", "#ff9d44", "#9ecfff", "#b3d9ff"]);
    renderPie("channelPie", data.channel, ["#4a90e2", "#35c2a0", "#ff9d44", "#6db3f2", "#7cc4ff"]);
    pieAutoHighlight("provincePie", data.provinceTop);
    pieAutoHighlight("channelPie", data.channel);
    renderProductBar(data.productTop);
    renderTrend(data.monthly);
    renderMap(data.map);
    renderProfitRate(data.profitRate);
    renderHotList(data.hotList);
}
loadData();
setInterval(loadData, 15000);  // 每 15 秒定时刷新数据
fitScreen();
