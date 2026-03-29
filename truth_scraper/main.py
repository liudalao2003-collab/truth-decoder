import requests
import urllib3
import time
import os
import re
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from extractors import EXTRACTORS # 🟢 核心：接入提取器生态网关

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 🚀 全局雷达配置 ---
API_ENDPOINT = "http://localhost:3000/api/v1/ingest" 
# 🚨 部署预警：必须确保系统环境变量中注入 INGEST_TOKEN
INGEST_TOKEN = os.getenv("INGEST_TOKEN", "[CENSORED_BY_ARCHITECT]")
HISTORY_FILE = "seen_urls.txt"

# 🟢 核心重构：合法注入 Reuters, WSJ 与 Bloomberg 的官方 RSS/新闻入口
TARGET_FEEDS = [
    "https://finance.yahoo.com/news/",
    "https://www.reutersagency.com/feed/",                 # Reuters 官方 RSS
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",       # WSJ 官方 RSS
    "https://feeds.bloomberg.com/markets/news.rss"         # Bloomberg 官方 RSS
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Connection": "keep-alive",
    }
    try:
        adapter = HTTPAdapter(max_retries=3)
        session.mount("https://", adapter)
        resp = session.get(url, headers=headers, verify=False, timeout=15)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: 猎犬请求 {url} 失败 - {str(e)[:50]}")
        return None

def extract_article_links(html, base_url):
    """
    核心业务说明：
    兼容 HTML <a> 标签与 XML(RSS) <item><link> 的双轨探测器。
    """
    soup = BeautifulSoup(html, 'html.parser')
    links = set()
    
    # 策略 1：尝试提取标准 RSS 的 link
    items = soup.find_all('item')
    if items:
        for item in items:
            link_tag = item.find('link')
            if link_tag and link_tag.text:
                links.add(link_tag.text.strip())
        return links

    # 策略 2：降级为 HTML 链接提取
    for a in soup.find_all('a', href=True):
        href = a['href']
        if '/news/' in href or '/m/' in href or '/articles/' in href:
            full_url = href if href.startswith('http') else base_url.rstrip('/') + '/' + href.lstrip('/')
            links.add(full_url)
    return links

def is_high_value_intel(content): 
     """ 
     核心业务说明： 
     工业级断头台算法 V5.8 (多源深度加固版)。 
     已全面注入 Reuters、Bloomberg、WSJ 的专属正则黑名单，物理级阻断大模型无效 Token 燃烧。 
     """ 
     if not content: 
         return False, "载荷真空" 
 
     content_lower = content.lower() 
 
     # 1. 跨平台通用致命词汇 (防引流、防订阅墙拦截) 
     FATAL_KEYWORDS = [ 
         "flagship newsletter", "inboxes every morning", "subscribe to", 
         "sign up for", "download the app", "click here to read", 
         "all rights reserved", "terms of service", "to read the full article" 
     ] 
     for word in FATAL_KEYWORDS: 
         if word in content_lower: 
             return False, f"触碰通用致命词汇 [{word}]" 
 
     # 2. 国际巨头媒体专属高维正则黑名单 
     # 🚨 Bloomberg 拦截矩阵：阻断播客引流、电视节目预告与短篇免责声明 
     if re.search(r'(listen to.*podcast|bloomberg radio|watch live on bloomberg tv)', content_lower): 
         return False, "触发 Bloomberg 音视频引流拦截机制" 
     if "bloomberg l.p." in content_lower and len(content) < 1000: 
         return False, "触发 Bloomberg 极短免责声明拦截机制" 
 
     # 🚨 Reuters 拦截矩阵：阻断编辑部尾注、记者署名与路透社信任原则声明 
     if re.search(r'(thomson reuters trust principles|compiled by|editing by|our standards:)', content_lower): 
         return False, "触发 Reuters 编辑部尾注/声明拦截机制" 
 
     # 🚨 WSJ 拦截矩阵：阻断专栏推广墙与系列播客 
     if re.search(r'(wsj pro|what to read next|listen to the full episode|heard on the street:)', content_lower): 
         return False, "触发 WSJ 专栏/播客引流拦截机制" 
 
     # 3. 物理长度防线 
     if len(content) < 800: 
         return False, f"篇幅过短 ({len(content)} 字符)" 
 
     # 4. 核心商业数据密度扫描 (利益流转的底层基石) 
     numbers = re.findall(r'\d+', content) 
     has_financial_symbols = '%' in content or '$' in content or 'billion' in content_lower or 'million' in content_lower 
     
     if len(numbers) < 3 and not has_financial_symbols: 
         return False, "数据密度归零 (完全缺乏核心金融数据与金额支撑)" 
 
     return True, "高维资产鉴别通过"

def route_and_extract(url, html):
    """
    核心业务说明：智能调度网关。遍历生态圈寻找匹配的解析器。
    """
    for extractor in EXTRACTORS:
        if extractor.match(url):
            return extractor.extract(html)
            
    # 如果没有任何专属提取器认领，走通用降级策略
    print("🟡 [模块_异步] -> 目标: 未命中专属契约，执行通用兜底 DOM 撕裂")
    soup = BeautifulSoup(html, 'html.parser')
    for element in soup(["script", "style", "nav", "footer", "aside"]):
        element.decompose()
    return "\n".join([p.get_text(strip=True) for p in soup.find_all('p') if len(p.get_text(strip=True)) > 50])

def main():
    print("==================================================")
    print("      TRUTH DECODER - CORE ENGINE V5.7 OVERHAUL   ")
    print("      [+] 启用全链路提取器生态与双轨探针...       ")
    print("==================================================")
    
    seen_urls = load_seen_urls()
    all_targets = set()

    # 1. 雷达全频段扫描
    for feed in TARGET_FEEDS:
        print(f"🟢 [模块_发起] -> 动作/参数: 阵地扫描 {feed}")
        html = fetch_html(feed)
        if html:
            base_parts = feed.split("/")
            base_url = f"{base_parts[0]}//{base_parts[2]}"
            all_targets.update(extract_article_links(html, base_url))
        time.sleep(1)

    fresh_targets = [url for url in all_targets if url not in seen_urls]
    print(f"\n🔵 [模块_成功] -> 产物: 锁定 {len(fresh_targets)} 条全新暗网线索\n")

    success_count = 0
    # 2. 单兵突击
    for url in fresh_targets:
        print(f"🟡 [模块_异步] -> 目标: {url[:60]}...")
        html = fetch_html(url)
        if not html: 
            continue

        # 🚨 异常托底：绝不允许单一 DOM 崩溃拖垮主线程
        try:
            raw_content = route_and_extract(url, html)
        except Exception as e:
            print(f"   🔴 [模块_崩溃] -> 原因: DOM 物理切片异常 ({str(e)})")
            continue

        # 🚨 断头台铡刀落下
        is_valuable, reject_reason = is_high_value_intel(raw_content)
        if not is_valuable:
            print(f"   🚫 [物理拦截] {reject_reason}")
            save_seen_url(url)
            continue

        try:
            print("   🟢 [模块_发起] -> 动作/参数: 密度达标，提交大模型网关破译")
            resp = requests.post(
                API_ENDPOINT, 
                json={"rawContent": raw_content}, 
                headers={"Authorization": f"Bearer {INGEST_TOKEN}"},
                timeout=60
            )
            if resp.status_code == 200:
                print("   🔵 [模块_成功] -> 产物: 致命裁决已生成入库！")
                save_seen_url(url)
                success_count += 1
            else:
                print(f"   🔴 [模块_崩溃] -> 原因: 网关拒绝接收 状态码 {resp.status_code}")
        except requests.exceptions.Timeout:
            print(f"   🔴 [模块_崩溃] -> 原因: 神经引擎思考超时")
        except Exception as e:
            print(f"   🔴 [模块_崩溃] -> 原因: 链路未知阻断 {str(e)[:30]}")
        
        time.sleep(2)

    print("\n==================================================")
    print(f"      🎉 引擎休眠！本次战役成功斩获 {success_count} 条高维资产。")
    print("==================================================")

if __name__ == "__main__":
    main()