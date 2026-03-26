import requests
import time
import urllib.parse
import os

# --- ⚙️ 核心配置 ---
API_FEED = "http://localhost:3000/api/feed"
API_WASH = "http://localhost:3000/api/v1/wash"
# 🚨 必须替换为你 .env 中的真实 Token！
TOKEN = "ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ="

def main():
    print("==================================================")
    print("      TRUTH DECODER - UNSTOPPABLE WASH V5.6       ")
    print("      [+] 正在执行全量资产红利重铸协议 (双语防污染版)...")
    print("      [!] 警告：此操作将消耗 DeepSeek Token           ")
    print("==================================================")
    
    cursor = ""
    total_washed = 0
    batch_count = 1

    while True:
        # 1. 物理拉取当前批次的情报
        url = f"{API_FEED}?cursor={urllib.parse.quote(cursor)}" if cursor else API_FEED
        print(f"\n📡 [批次 {batch_count}] 正在从数据库提取情报分片...")
        
        try:
            res = requests.get(url, timeout=20).json()
            batch_data = res.get("data", [])
            
            if not batch_data:
                print("🏁 [终点] 数据库已全部扫荡完毕。没有更多资产需要清洗。")
                break

            print(f"🔎 发现 {len(batch_data)} 条资产，准备注入“双语纯血”灵魂...")

            # 2. 逐条进行“心脏搭桥”手术
            for s in batch_data:
                signal_id = s.get('id')
                raw_content = s.get('raw_content')

                print(f"   🟡 [重塑中] {signal_id} ... ", end="", flush=True)
                
                try:
                    payload = {"id": signal_id, "rawContent": raw_content}
                    resp = requests.post(
                        API_WASH, 
                        json=payload, 
                        headers={"Authorization": f"Bearer {TOKEN}"}, 
                        timeout=90 # DeepSeek 深度思考可能较慢，给足耐心
                    )
                    
                    if resp.status_code == 200:
                        print("✅ 已觉醒 (双语重铸完成)")
                        total_washed += 1
                    else:
                        print(f"❌ 失败 ({resp.status_code}) - {resp.text}")
                except Exception as e:
                    print(f"❌ 链路超时 ({str(e)})")
                
                # 3. 物理冷却：防止 DeepSeek 并发限制，给 AI 喘息时间
                time.sleep(2)

            # 4. 更新游标，指向下一片猎场
            cursor = batch_data[-1]["created_at"]
            batch_count += 1
            print(f"--------------------------------------------------")
            print(f"💡 当前进度：已重铸 {total_washed} 条资产")
            print(f"--------------------------------------------------")

        except Exception as e:
            print(f"🔴 [致命错误] 数据库通信中断: {e}")
            break

    print(f"\n==================================================")
    print(f"      🎉 战役结束！全量资产重塑完毕。")
    print(f"      共计清洗：{total_washed} 条情报资产")
    print("==================================================")

if __name__ == "__main__":
    main()