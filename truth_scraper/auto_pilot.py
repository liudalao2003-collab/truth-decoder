import schedule
import time
import subprocess
import os
import requests
from dotenv import load_dotenv

# 🚨 物理级读取项目根目录的 .env 文件
load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def check_manual_trigger():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("🟡 [警告] 环境配置残缺，雷达暂时致盲...")
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # 查询是否存在 PENDING 状态的物理旗帜
        url = f"{SUPABASE_URL}/rest/v1/system_configs?id=eq.manual_trigger_signal&select=value"
        resp = requests.get(url, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                val = data[0].get("value", {})
                if val.get("status") == "PENDING":
                    print("\n🚨 [总控台] -> 侦测到 CEO 手动触发信号！即刻执行越权打击！")
                    
                    # 抹杀旗帜状态
                    patch_url = f"{SUPABASE_URL}/rest/v1/system_configs?id=eq.manual_trigger_signal"
                    requests.patch(patch_url, headers=headers, json={"value": {"status": "COMPLETED"}})
                    
                    # 唤醒猎犬
                    run_hunter_killer()
        else:
            # 🚀 探针补强：如果状态码不是 200，立刻报警
            print(f"🔴 [雷达故障] 无法连接 Supabase: HTTP {resp.status_code} - {resp.text}")

    except Exception as e:
        # 🚀 拒绝静默：暴露出真实的物理死因
        print(f"🔴 [连接崩塌] 雷达扫描中断: {str(e)}")

def run_hunter_killer():
    print("\n" + "="*50)
    print("      TRUTH DECODER - ENGINE WAKEUP")
    print("==================================================")
    # 强制使用当前环境的 python 执行
    subprocess.run(["python", "truth_scraper/main.py"], cwd=os.getcwd())

def main():
    print("==================================================")
    print("      TRUTH DECODER - AUTO PILOT V5.9")
    print("      雷达持续扫描中 (心跳: 1s)...")
    print("==================================================")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ 错误: 未检测到凭证，请检查 .env 文件")
        return

    # 物理级死循环
    while True:
        try:
            schedule.run_pending()
            check_manual_trigger()
            time.sleep(1) # 每秒扫描一次数据库旗帜
        except KeyboardInterrupt:
            print("\n退出系统。")
            break
        except Exception as e:
            print(f"守护进程异常: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()