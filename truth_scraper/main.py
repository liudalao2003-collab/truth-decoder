import requests
import urllib3
import json
import re
import time
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from extractors import EXTRACTORS

# 物理级静音：屏蔽强制绕过 SSL 时产生的警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 核心配置区 ---
INDEX_URL = "https://finance.yahoo.com/news/" 
API_ENDPOINT = "http://localhost:3000/api/v1/ingest" 
INGEST_TOKEN = "ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ="

# 🎯 商业硬通货词库
BUSINESS_KEYWORDS = ["layoff", "job cut", "acquire", "acquisition", "merger", "bankruptcy", "chapter 11", "revenue", "profit", "stake", "resign", "restructuring", "buyout"]

def fetch_html(url: str) -> str:
    print(f"🟢 [模块_发起] -> 动作/参数: 潜入目标节点 {url}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
    }
    
    try:
        # 🚀 物理补丁：强制使用适应性更强的 HTTPAdapter，解决 SSLEOFError
        session = requests.Session()
        adapter = HTTPAdapter(max_retries=3)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        
        # 🚨 关键：verify=False 配合定制 Session 绕过本地证书校验限制
        resp = session.get(url, headers=headers, verify=False, timeout=15)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: 物理连接阻断 - {str(e)}")
        return ""

def discover_all_articles(index_html: str) -> list:
    soup = BeautifulSoup(index_html, 'html.parser')
    links = soup.find_all('a', href=re.compile(r'/news/.*\.html'))
    target_urls = list(set([ (href if href.startswith('http') else f"https://finance.yahoo.com{href}") for link in links if (href := link.get('href')) and 'video' not in href ]))
    print(f"🔵 [模块_成功] -> 产物: 建立猎杀名单，共发现 {len(target_urls)} 个潜在目标")
    return target_urls

def validate_intel(text: str) -> bool:
    text_lower = text.lower()
    hit_count = sum(1 for keyword in BUSINESS_KEYWORDS if keyword in text_lower)
    return hit_count >= 2

def main():
    print("==================================================")
    print("      TRUTH DECODER - PRO SCRAPER ENGINE v4.2     ")
    print("      [+] SSL 弹性补丁 + 持续猎杀循环             ")
    print("==================================================")
    
    index_html = fetch_html(INDEX_URL)
    if not index_html: return

    targets = discover_all_articles(index_html)
    for idx, target_url in enumerate(targets):
        print(f"\n🟢 [模块_发起] -> 动作/参数: 执行下潜 [{idx + 1}/{len(targets)}]: {target_url}")
        
        article_html = fetch_html(target_url)
        if not article_html: continue

        # 挂载策略提取正文
        from extractors import EXTRACTORS
        extractor = next((e for e in EXTRACTORS if e.match(target_url)), None)
        raw_content = extractor.extract(article_html) if extractor else "\n".join([p.get_text(strip=True) for p in BeautifulSoup(article_html, 'html.parser').find_all('p') if len(p.get_text(strip=True)) > 50])

        if len(raw_content) < 300 or not validate_intel(raw_content):
            print("🔴 [模块_崩溃] -> 原因: 情报密度不足或非商业动作，放弃目标。")
            continue

        # 跨栈发射
        try:
            resp = requests.post(API_ENDPOINT, json={"rawContent": raw_content}, headers={"Authorization": f"Bearer {INGEST_TOKEN}"}, verify=False)
            if resp.status_code == 200 and resp.json().get("success"):
                print(f"🔵 [模块_成功] -> 产物: 猎杀成功！Signal ID: {resp.json()['data']['signalId']}")
                break 
        except Exception as e:
            print(f"🔴 [模块_崩溃] -> 原因: API 通信失败 - {e}")
        time.sleep(1)

if __name__ == "__main__":
    main()