"""Flask 应用入口"""
import os
import random

import pandas as pd
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# 省份简称 -> 中国地图全称（用于 ECharts 地图名称匹配）
PROVINCE_FULL = {
    "北京": "北京市", "天津": "天津市", "上海": "上海市", "重庆": "重庆市",
    "河北": "河北省", "山西": "山西省", "辽宁": "辽宁省", "吉林": "吉林省",
    "黑龙江": "黑龙江省", "江苏": "江苏省", "浙江": "浙江省", "安徽": "安徽省",
    "福建": "福建省", "江西": "江西省", "山东": "山东省", "河南": "河南省",
    "湖北": "湖北省", "湖南": "湖南省", "广东": "广东省", "海南": "海南省",
    "四川": "四川省", "贵州": "贵州省", "云南": "云南省", "陕西": "陕西省",
    "甘肃": "甘肃省", "青海": "青海省", "台湾": "台湾省",
    "广西": "广西壮族自治区", "内蒙古": "内蒙古自治区", "宁夏": "宁夏回族自治区",
    "新疆": "新疆维吾尔自治区", "西藏": "西藏自治区",
    "香港": "香港特别行政区", "澳门": "澳门特别行政区",
}


def _load_sales():
    """读取销售数据 CSV"""
    return pd.read_csv(os.path.join(app.root_path, "data", "data.csv"))


@app.route("/")
def index():
    """首页"""
    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    """数据大屏页面"""
    return render_template("dashboard.html")


@app.route("/api/dashboard")
def api_dashboard():
    """大屏数据接口：聚合 CSV 数据并模拟实时波动"""
    df = _load_sales()

    # 模拟实时数据波动（±2%），让大屏定时刷新时可见变化
    for col, nd in (("销量", 0), ("销售额", 2), ("利润", 2)):
        df[col] = (df[col] * random.uniform(0.98, 1.02)).round(nd)

    df["月份"] = df["日期"].str[:7]
    df["省份全称"] = df["省份"].map(PROVINCE_FULL).fillna(df["省份"])

    total_amount = float(df["销售额"].sum())
    total_profit = float(df["利润"].sum())

    def agg_sum(by, top=None):
        """按维度聚合销售额，降序"""
        g = df.groupby(by)["销售额"].sum().sort_values(ascending=False)
        if top:
            g = g.head(top)
        return [{"name": str(n), "value": round(float(v), 2)} for n, v in g.items()]

    # 各产品利润率（利润 / 销售额）
    p = df.groupby("产品")[["销售额", "利润"]].sum()
    profit_rate = [
        {"name": n, "rate": round(float(v) * 100, 1)}
        for n, v in (p["利润"] / p["销售额"]).sort_values(ascending=False).items()
    ]

    return jsonify({
        "kpi": {
            "amount": round(total_amount, 2),                       # 总销售额
            "profit": round(total_profit, 2),                       # 总利润
            "qty": int(df["销量"].sum()),                            # 总销量
            "margin": round(total_profit / total_amount * 100, 1),  # 利润率%
            "provinces": int(df["省份"].nunique()),                  # 覆盖省份
        },
        "monthly": [
            {"month": m, "amount": round(float(r["销售额"]), 2), "profit": round(float(r["利润"]), 2)}
            for m, r in df.groupby("月份")[["销售额", "利润"]].sum().iterrows()
        ],
        "map": agg_sum("省份全称"),        # 地图数据（全称）
        "provinceTop": agg_sum("省份", 8),  # 地区占比 Top8（简称）
        "productTop": agg_sum("产品", 8),   # 产品排行 Top8
        "channel": agg_sum("渠道"),         # 渠道占比
        "profitRate": profit_rate,          # 产品利润率
        "hotList": agg_sum("省份", 10),     # 地区热榜 Top10
        # 最新 20 条销售明细（json round-trip 处理 numpy 类型）
        "detail": __import__("json").loads(
            df.sort_values("日期", ascending=False).head(20).to_json(orient="records", force_ascii=False)
        ),
        "updateTime": pd.Timestamp.now().strftime("%H:%M:%S"),
    })


@app.route("/api/health")
def health():
    """健康检查接口"""
    return {"status": "ok"}


if __name__ == "__main__":
    # debug=True 仅用于开发环境，生产环境需关闭
    app.run(host="127.0.0.1", port=5000, debug=True)
