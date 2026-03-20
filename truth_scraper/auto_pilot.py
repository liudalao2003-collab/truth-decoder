import schedule
import time
import subprocess
import os

# 核心业务说明：这是 TruthDecoder 的自动化总控台（守护进程）。
# 它永远不会退出，只会在你设定的时间点，默默拉起 main.py 去外网“进货”。

def run_hunter_killer():
    """唤醒底层爬虫引擎"""
    print("\n" + "="*50)
    print("      TRUTH DECODER - SYSTEM WAKEUP [AUTO]        ")
    print("      [+] 定时巡航已触发，释放猎犬...             ")
    print("==================================================")
    
    # 物理级拉起子进程执行 main.py
    # cwd 确保在项目的根目录下执行，防止路径错乱
    subprocess.run(["python", "truth_scraper/main.py"], cwd=os.getcwd())
    
    print("\n🟢 [总控台] -> 状态: 本次巡航任务结束。系统进入深度休眠，等待下一次唤醒...\n")

def main():
    print("==================================================")
    print("      TRUTH DECODER - AUTO PILOT ENGAGED          ")
    print("      [+] 本地守护进程已就绪，保持窗口开启...     ")
    print("==================================================")

    # 测试期间，每 60 秒扫射一次全网
    schedule.every(1).minutes.do(run_hunter_killer)

    # 物理级死循环：永远保持心脏跳动 (1秒检查一次到没到时间)
    while True:
        try:
            schedule.run_pending()
            time.sleep(1)
        except KeyboardInterrupt:
            print("\n🔴 [总控台] -> 状态: 接收到物理阻断信号 (Ctrl+C)，守护进程已终止。")
            break
        except Exception as e:
            print(f"\n🔴 [总控台] -> 严重错误: 守护进程崩溃 - {str(e)}")
            time.sleep(60) # 如果崩溃，强行休眠一分钟再试，防止 CPU 爆炸

if __name__ == "__main__":
    main()