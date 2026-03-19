import requests
import urllib3
import json
import time
from bs4 import BeautifulSoup
from extractors import EXTRACTORS

# 物理级静音：屏蔽强制绕过 SSL 时产生的安全警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 核心配置区 (The War Room) ---
# 🚨 架构师建议：严禁抓取首页！必须锁定具体的商业新闻文章 URL
TARGET_URL = "https://www.reuters.com/business/finance/goldman-sachs-ceo-solomon-sees-strong-investment-banking-recovery-2024-03-18/" 

# 内部网关配置 [cite: 81-83]
API_ENDPOINT = "http://localhost:3000/api/v1/ingest" 
INGEST_TOKEN = "ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ="

def get_extractor(url: str):
    """遍历策略阵列，动态分发提取器"""
    for ext in EXTRACTORS:
        if ext.match(url):
            return ext
    return None

def fetch_html(url: str) -> str:
    """
    目标：高强度模拟真实浏览器，穿透路透社/WSJ 的 WAF 防线。
    """
    print(f"🟢 [模块_发起] -> 动作/参数: 启动拟人化物理穿透，目标: {url}")
    
    # 模拟 Chrome 122 完整指纹 (Fingerprint)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }
    
    try:
        # 使用 Session 对象自动管理 Cookie，增加拟人化权重 
        session = requests.Session()
        print(f"🟡 [模块_异步] -> 目标: 正在绕过 WAF 边缘检测...")
        
        # 强制禁用 SSL 验证，确保在各种环境下都能物理导通 [cite: 188, 191]
        resp = session.get(url, headers=headers, verify=False, timeout=20)
        
        if resp.status_code in [401, 403]:
            print(f"🔴 [模块_崩溃] -> 原因: 节点被拦截 (HTTP {resp.status_code})。WAF 侦测到自动化特征。")
            return ""
            
        resp.raise_for_status()
        print(f"🔵 [模块_成功] -> 产物: 穿透成功，源码体积 {len(resp.text)} 字节")
        return resp.text
        
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: 链路阻断 - {str(e)}")
        return ""

def extract_text(url: str, html: str) -> str:
    """策略模式分发执行核心"""
    if not html:
        return ""
        
    extractor = get_extractor(url)
    if extractor:
        return extractor.extract(html)
        
    # 降级方案：通用 DOM 提取
    print("🟡 [模块_异步] -> 目标: 未匹配专属策略，执行通用降级提取")
    soup = BeautifulSoup(html, 'html.parser')
    for element in soup(["script", "style", "nav", "footer", "aside"]):
        element.decompose()
    paragraphs = soup.find_all('p')
    return "\n".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30])

def main():
    print("==================================================")
    print("      TRUTH DECODER - PRO SCRAPER ENGINE v2.1     ")
    print("      STATUS: HIGH-INTENSITY BYPASS ACTIVE        ")
    print("==================================================")
    
    # 1. 抓取 [cite: 38-41]
    html = fetch_html(TARGET_URL)
    
    # 2. 洗稿 (基于 Extractors 目录下的子模块)
    raw_content = extract_text(TARGET_URL, html)
    
    if not raw_content:
        print("🔴 [模块_崩溃] -> 原因: 情报剥离失败，请检查 URL 是否有效")
        return
        
    print(f"🔵 [模块_成功] -> 产物: 洗稿完毕，有效文本长度: {len(raw_content)}")
    
    # 3. 跨栈发射 (携带特权令牌) [cite: 81-82, 175]
    print(f"🟡 [模块_异步] -> 目标: 正在将情报打入 Next.js 解码引擎...")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {INGEST_TOKEN}"
    }
    
    try:
        resp = requests.post(API_ENDPOINT, json={"rawContent": raw_content}, headers=headers, verify=False)
        result = resp.json()
        
        if resp.status_code == 200 and result.get("success"):
            signal_id = result['data']['signalId']
            print(f"🔵 [模块_成功] -> 产物: 高净值情报入库! Signal: {signal_id}")
            print(f"🔗 访问地址: http://localhost:3000/decode/{signal_id}")
        else:
            print(f"🔴 [模块_崩溃] -> 原因: 引擎拒绝注入 - {result.get('error')}")
            
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: API 发射失败 - {str(e)}")

if __name__ == "__main__":
    main()