# -*- coding: utf-8 -*-
"""生成模拟销售数据（酒水饮料），300 条，输出到 data/data.csv"""
import os
import random
import pandas as pd

random.seed(42)  # 固定随机种子，保证数据可复现

# 省份（覆盖面广）
PROVINCES = [
    "广东", "江苏", "山东", "浙江", "河南", "四川", "湖北", "湖南",
    "河北", "安徽", "福建", "陕西", "辽宁", "江西", "云南", "广西",
    "山西", "贵州", "重庆", "天津", "北京", "上海",
]

# 产品（酒水饮料）：名称 -> (单价元, 利润率)
PRODUCTS = {
    "农夫山泉550ml": (2.0, 0.25),
    "可口可乐500ml": (3.0, 0.20),
    "雪碧500ml":     (3.0, 0.20),
    "王老吉310ml":   (4.5, 0.22),
    "冰红茶500ml":   (3.5, 0.22),
    "青岛啤酒500ml": (6.0, 0.18),
    "雪花啤酒500ml": (5.0, 0.18),
    "江小白100ml":   (12.0, 0.30),
    "茅台王子酒":    (328.0, 0.35),
    "长城干红":      (88.0, 0.28),
}

# 销售渠道
CHANNELS = ["商超", "便利店", "电商平台", "餐饮", "批发"]

rows = []
for i in range(300):
    date = pd.Timestamp("2026-01-01") + pd.Timedelta(days=random.randint(0, 270))  # 2026年随机日期
    product = random.choice(list(PRODUCTS))
    price, margin = PRODUCTS[product]
    qty = random.randint(50, 2000)                       # 销量（件）
    amount = round(qty * price * random.uniform(0.9, 1.1), 2)  # 销售额（含价格浮动）
    profit = round(amount * margin * random.uniform(0.85, 1.15), 2)  # 利润（含浮动）
    rows.append({
        "日期": date.strftime("%Y-%m-%d"),
        "省份": random.choice(PROVINCES),
        "产品": product,
        "渠道": random.choice(CHANNELS),
        "销量": qty,
        "销售额": amount,
        "利润": profit,
    })

df = pd.DataFrame(rows).sort_values("日期").reset_index(drop=True)

os.makedirs("data", exist_ok=True)
df.to_csv("data/data.csv", index=False, encoding="utf-8-sig")
print(f"已生成 {len(df)} 条数据 -> data/data.csv")
print(df.head())
print(df["省份"].nunique(), "个省份 |", df["产品"].nunique(), "个产品 |", df["渠道"].nunique(), "个渠道")
