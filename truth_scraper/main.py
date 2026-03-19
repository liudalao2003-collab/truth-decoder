import requests
import urllib3
import json
import re
from bs4 import BeautifulSoup
from extractors import EXTRACTORS

# 物理级静音
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 核心配置区 ---
INDEX_URL = "https://finance.yahoo.com/news/" 
API_ENDPOINT = "http://localhost:3000/api/v1/ingest" 
INGEST_TOKEN = "ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ="

# 🎯 核心防线：商业硬通货词库 (The Sniper Scope)
# 只有命中这些底层利益流转词汇的文章，才配进入解码引擎
BUSINESS_KEYWORDS = [
    "layoff", "job cut", "acquire", "acquisition", "merger", "bankruptcy", 
    "chapter 11", "revenue", "profit", "stake", "resign", "step down", 
    "sec filing", "restructuring", "buyout", "lawsuit", "subpoena"
]

def get_extractor(url: str):
    for ext in EXTRACTORS:
        if ext.match(url): return ext
    return None

def fetch_html(url: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
    }
    try:
        session = requests.Session()
        resp = session.get(url, headers=headers, verify=False, timeout=15)
        if resp.status_code == 404: return ""
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: 物理连接阻断 - {str(e)}")
        return ""

def discover_first_article(index_html: str) -> str:
    soup = BeautifulSoup(index_html, 'html.parser')
    links = soup.find_all('a', href=re.compile(r'/news/.*\.html'))
    for link in links:
        href = link.get('href')
        if not href: continue
        full_url = href if href.startswith('http') else f"https://finance.yahoo.com{href}"
        if 'video' not in full_url:
            return full_url
    return ""

def validate_intel(text: str) -> bool:
    """
    嗅探器逻辑：检测文章是否含有足够的商业硬通货。
    """
    text_lower = text.lower()
    hit_count = sum(1 for keyword in BUSINESS_KEYWORDS if keyword in text_lower)
    
    # 策略：至少命中 2 个核心商业词汇，才被认定为高价值通稿
    if hit_count >= 2:
        print(f"🔵 [模块_成功] -> 产物: 嗅探到高浓度商业动作，命中特征词 {hit_count} 次")
        return True
    else:
        print(f"🔴 [模块_崩溃] -> 原因: 商业特征极其微弱 (命中 {hit_count} 次)，判定为无价值营销废话，执行本地销毁")
        return False

def extract_text(url: str, html: str) -> str:
    if not html: return ""
    extractor = get_extractor(url)
    if extractor:
        return extractor.extract(html)
        
    soup = BeautifulSoup(html, 'html.parser')
    for element in soup(["script", "style", "nav", "footer", "aside"]):
        element.decompose()
    paragraphs = soup.find_all('p')
    return "\n".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 50])

def main():
    print("==================================================")
    print("      TRUTH DECODER - PRO SCRAPER ENGINE v4.0     ")
    print("      [+] 挂载高净值商业硬通货嗅探防线            ")
    print("==================================================")
    
    print(f"🟢 [模块_发起] -> 动作/参数: 潜入目录页 {INDEX_URL}")
    index_html = fetch_html(INDEX_URL)
    if not index_html: return

    target_article_url = discover_first_article(index_html)
    if not target_article_url:
        print("🔴 [模块_崩溃] -> 原因: 未发现有效文章链接")
        return

    print(f"🟢 [模块_发起] -> 动作/参数: 锁定目标，执行下潜: {target_article_url}")
    article_html = fetch_html(target_article_url)
    raw_content = extract_text(target_article_url, article_html)
    
    if len(raw_content) < 300:
        print(f"🔴 [模块_崩溃] -> 原因: 文本厚度不足 ({len(raw_content)} 字符)，强制阻断")
        return

    # 🚨 核心防线拦截：数据过滤
    print("🟡 [模块_异步] -> 目标: 执行商业价值验资...")
    if not validate_intel(raw_content):
        return # 如果是营销废话，直接中断程序，不消耗任何 DeepSeek Token
        
    print(f"🟡 [模块_异步] -> 目标: 验资通过。跨栈发射至 DeepSeek 解码引擎...")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {INGEST_TOKEN}"
    }
    try:
        resp = requests.post(API_ENDPOINT, json={"rawContent": raw_content}, headers=headers, verify=False)
        result = resp.json()
        if resp.status_code == 200 and result.get("success"):
            print(f"🔵 [模块_成功] -> 产物: 商业动作已解密入库! 🔗 http://localhost:3000/decode/{result['data']['signalId']}")
        else:
            print(f"🔴 [模块_崩溃] -> 原因: 后端网关拒绝注入 - {result.get('error')}")
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: 链路断裂 - {str(e)}")

if __name__ == "__main__":
    main()