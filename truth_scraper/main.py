import requests
import urllib3
import time
import os
import re
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 🚀 全局雷达配置 ---
API_ENDPOINT = "http://localhost:3000/api/v1/ingest" 
INGEST_TOKEN = "ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ="
HISTORY_FILE = "seen_urls.txt"

TARGET_FEEDS = [
    "https://finance.yahoo.com/news/",
    "https://finance.yahoo.com/topic/stock-market-news/",
    "https://finance.yahoo.com/topic/economic-news/",
    "https://finance.yahoo.com/section/tech/"
]

def load_seen_urls():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return set(f.read().splitlines())
    return set()

def save_seen_url(url):
    with open(HISTORY_FILE, "a") as f:
        f.write(url + "\n")

def fetch_html(url):
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
    }
    try:
        adapter = HTTPAdapter(max_retries=3)
        session.mount("https://", adapter)
        resp = session.get(url, headers=headers, verify=False, timeout=15)
        resp.raise_for_status()
        return resp.text
    except:
        return None

def extract_article_links(html, base_url="https://finance.yahoo.com"):
    soup = BeautifulSoup(html, 'html.parser')
    links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        if '/news/' in href or '/m/' in href:
            full_url = href if href.startswith('http') else base_url + href
            links.add(full_url)
    return links

# 🛡️ V5.6 工业级断头台算法
def is_high_value_intel(content):
    content_lower = content.lower()

    # 1. 致命词汇一击必杀 (只要出现一次，立刻拉黑)
    FATAL_KEYWORDS = [
        "flagship newsletter", "inboxes every morning", "subscribe to",
        "sign up for yahoo", "download the app", "click here to read",
        "morning brief is yahoo"
    ]
    for word in FATAL_KEYWORDS:
        if word in content_lower:
            return False, f"触碰致命广告词 [{word}]"

    # 2. 长度底线
    if len(content) < 800:
        return False, f"篇幅过短 ({len(content)} 字符)"

    # 3. 🚀 商业数据密度检测 (真正的商业新闻必然包含数据)
    # 提取所有数字
    numbers = re.findall(r'\d+', content)
    has_financial_symbols = '%' in content or '$' in content or 'billion' in content_lower or 'million' in content_lower
    
    # 如果一篇文章里数字少于 3 个，且没有任何金融符号，100% 是空洞的软文或散文
    if len(numbers) < 3 and not has_financial_symbols:
        return False, "情报密度极低 (缺乏商业数据和金额支撑)"

    return True, "通过高净值甄别"

def main():
    print("==================================================")
    print("      TRUTH DECODER - OPERATION: GUILLOTINE V5.6  ")
    print("      [+] 搭载商业数据密度扫描仪，全量斩杀软文      ")
    print("==================================================")
    
    seen_urls = load_seen_urls()
    all_targets = set()

    for feed in TARGET_FEEDS:
        print(f"🟢 [雷达扫描] 侦测阵地: {feed}")
        html = fetch_html(feed)
        if html:
            all_targets.update(extract_article_links(html))
        time.sleep(1)

    fresh_targets = [url for url in all_targets if url not in seen_urls]
    print(f"\n🔵 [初筛] 锁定 {len(fresh_targets)} 条线索，进入断头台甄别舱...\n")

    success_count = 0
    for url in fresh_targets:
        print(f"🟡 [分析] 目标: {url[:50]}...")
        html = fetch_html(url)
        if not html: 
            continue

        soup = BeautifulSoup(html, 'html.parser')
        paragraphs = soup.find_all('p')
        raw_content = "\n".join([p.get_text() for p in paragraphs if len(p.get_text()) > 60])

        # 🚨 断头台铡刀落下
        is_valuable, reject_reason = is_high_value_intel(raw_content)
        if not is_valuable:
            print(f"   🚫 [物理拦截] {reject_reason}，已销毁。")
            save_seen_url(url) # 记入黑名单，不再碰它
            continue

        try:
            print("   🟢 [密度达标] 确认包含核心商业数据，正在提交 AI 破译...")
            resp = requests.post(
                API_ENDPOINT, 
                json={"rawContent": raw_content}, 
                headers={"Authorization": f"Bearer {INGEST_TOKEN}"},
                timeout=60
            )
            if resp.status_code == 200:
                print("   ✅ [入库成功] 致命裁决已生成！")
                save_seen_url(url)
                success_count += 1
            else:
                print(f"   ❌ [被后端拦截] 状态码: {resp.status_code} (可能是重复通稿)")
        except requests.exceptions.Timeout:
            print(f"   ❌ [链路中断] DeepSeek 思考超时，跳过。")
        except Exception as e:
            print(f"   ❌ [未知异常] {str(e)[:30]}")
        
        time.sleep(2)

    print("\n==================================================")
    print(f"      🎉 猎杀结束！成功斩获 {success_count} 条纯粹的高密度商业资产。")
    print("==================================================")

if __name__ == "__main__":
    main()