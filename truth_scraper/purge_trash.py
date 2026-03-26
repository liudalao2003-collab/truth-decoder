import requests
import time
import urllib.parse
import re

# --- ⚙️ 核心配置 ---
API_FEED = "http://localhost:3000/api/feed"
API_DELETE = "http://localhost:3000/api/v1/delete"
# 🚨 必须替换为你 .env 中的真实 INGEST_TOKEN！
TOKEN = "ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ="

def is_high_value_intel(content):
    """复用 V5.6 工业级断头台算法进行资产审计 [cite: 538-540]"""
    if not content: return False, "空数据"
    content_lower = content.lower()

    # 1. 致命词汇拦截 (广告与营销软文) 
    FATAL_KEYWORDS = [
        "flagship newsletter", "subscribe to", "sign up for", 
        "download the app", "click here to read"
    ]
    for word in FATAL_KEYWORDS:
        if word in content_lower:
            return False, f"触碰致命词汇 [{word}]"

    # 2. 长度底线审计 
    if len(content) < 800:
        return False, f"篇幅过短 ({len(content)} 字符)"

    # 3. 商业数据密度检测 
    numbers = re.findall(r'\d+', content)
    has_financial_symbols = '%' in content or '$' in content or 'billion' in content_lower
    if len(numbers) < 3 and not has_financial_symbols:
        return False, "情报密度极低 (无核心金融数据)"

    return True, "高净值资产"

def main():
    print("==================================================")
    print("      TRUTH DECODER - DATABASE PURGE PROTOCOL     ")
    print("      [+] 正在执行存量资产物理净化...             ")
    print("==================================================")
    
    cursor = ""
    total_scanned = 0
    total_purged = 0
    batch_count = 1

    while True:
        # 1. 分片提取情报 [cite: 217-221]
        url = f"{API_FEED}?cursor={urllib.parse.quote(cursor)}" if cursor else API_FEED
        try:
            res = requests.get(url, timeout=20).json()
            batch_data = res.get("data", [])
            if not batch_data: break

            print(f"\n🔎 [批次 {batch_count}] 正在审计 {len(batch_data)} 条记录...")

            # 2. 逐条审计
            for s in batch_data:
                total_scanned += 1
                signal_id = s.get('id')
                raw_content = s.get('raw_content', '')

                is_valuable, reason = is_high_value_intel(raw_content)
                
                if not is_valuable:
                    # 3. 物理执行抹杀 [cite: 265-272]
                    print(f"   🔴 [抹杀] {signal_id} -> 原因: {reason} ... ", end="", flush=True)
                    del_res = requests.delete(
                        f"{API_DELETE}?id={signal_id}",
                        headers={"Authorization": f"Bearer {TOKEN}"},
                        timeout=10
                    ).json()
                    
                    if del_res.get("success"):
                        print("DONE")
                        total_purged += 1
                    else:
                        print(f"FAILED ({del_res.get('error')})")
                else:
                    print(f"   🟢 [保留] {signal_id} (高净值)")

            # 4. 更新游标
            cursor = batch_data[-1]["created_at"]
            batch_count += 1
            time.sleep(0.5) # 保护数据库 IO

        except Exception as e:
            print(f"🔴 [致命错误] 通信中断: {e}")
            break

    print(f"\n==================================================")
    print(f"      🎉 净化结束！")
    print(f"      扫描总数：{total_scanned} | 物理销毁：{total_purged}")
    print(f"      剩余待清洗高价值资产：{total_scanned - total_purged}")
    print("==================================================")

if __name__ == "__main__":
    main()