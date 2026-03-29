import schedule
import time
import subprocess
import os
import requests
from dotenv import load_dotenv

# 🚨 核心注入：物理级读取项目根目录的 .env 文件
load_dotenv()

# 🚨 核心配置：载入 Supabase 环境变量，用于轮询指令旗帜
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def check_manual_trigger():
    """
    核心业务说明：
    异步指令侦测雷达。
    以极低消耗轮询 Supabase 数据库，检测 CEO 是否在中控台按下了“立即执行”按钮。
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # 1. 探针：查询是否存在 PENDING 状态的物理旗帜
        url = f"{SUPABASE_URL}/rest/v1/system_configs?id=eq.manual_trigger_signal&select=value"
        resp = requests.get(url, headers=headers, timeout=5)
        
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                val = data[0].get("value", {})
                if val.get("status") == "PENDING":
                    print("\n🚨 [总控台] -> 侦测到 CEO 手动触发信号 (Manual Trigger)！即刻执行越权打击！")
                    
                    # 2. 擦除：将旗帜状态改为 COMPLETED，防止重复触发
                    patch_url = f"{SUPABASE_URL}/rest/v1/system_configs?id=eq.manual_trigger_signal"
                    requests.patch(patch_url, headers=headers, json={"value": {"status": "COMPLETED"}})
                    
                    # 3. 猎杀：物理拉起主程序
                    run_hunter_killer()
    except requests.exceptions.RequestException:
        pass # 保持静默，不污染日志面板

def run_hunter_killer():
    """唤醒底层爬虫引擎"""
    print("\n" + "="*50)
    print("      TRUTH DECODER - SYSTEM WAKEUP               ")
    print("      [+] 引擎轰鸣，释放猎犬...                   ")
    print("==================================================")
    
    subprocess.run(["python", "truth_scraper/main.py"], cwd=os.getcwd())
    
    print("\n🟢 [总控台] -> 状态: 本次任务结束。系统进入深度休眠，等待下一次指令...\n")

def main():
    print("==================================================")
    print("      TRUTH DECODER - AUTO PILOT ENGAGED V5.8     ")
    print("      [+] 守护进程已就绪，雷达持续扫描中...       ")
    print("==================================================")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("🔴 [致命崩溃] 未检测到 Supabase 凭证！请检查根目录 .env 文件是否配置正确！")

    schedule.every(60).minutes.do(run_hunter_killer)

    # 🚨 架构师微操：在进入死循环前，强行先拉起一次猎犬！
    print("🟢 [总控台] -> 初始点火：启动首次全网扫荡...")
    run_hunter_killer()

    # 物理级死循环
    while True:
        try:
            # 1. 检查是否到达定时巡航时间
            schedule.run_pending()
            
            # 2. 检查是否有 CEO 的手动触发指令
            check_manual_trigger()
            
            # 心跳间隔 1 秒
            time.sleep(1)
        except KeyboardInterrupt:
            print("\n🔴 [总控台] -> 状态: 接收到物理阻断信号 (Ctrl+C)，守护进程已终止。")
            break
        except Exception as e:
            print(f"\n🔴 [总控台] -> 严重错误: 守护进程崩溃 - {str(e)}")
            time.sleep(10)

if __name__ == "__main__":
    main()