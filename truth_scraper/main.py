import requests
import urllib3
import time
import os
import re
import json # 🟢 新增：用于解析流媒体碎片
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from extractors import EXTRACTORS 
from dotenv import load_dotenv

load_dotenv()
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 🚀 全局雷达配置 ---
# 🚨 架构师加固：支持通过 .env 配置生产环境的 Vercel 域名
BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000").rstrip('/')
API_INGEST = f"{BASE_URL}/api/v1/ingest"
API_SAVE = f"{BASE_URL}/api/v1/ingest/save"

INGEST_TOKEN = os.getenv("INGEST_TOKEN", "[CENSORED_BY_ARCHITECT]")
HISTORY_FILE = "seen_urls.txt"

TARGET_FEEDS = [
    "https://finance.yahoo.com/news/",
    "https://www.reutersagency.com/feed/",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://feeds.bloomberg.com/markets/news.rss"
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
        print(f"🔴 [模块_崩溃] -> 原因: 猎犬请求 {url} 失败")
        return None

def extract_article_links(html, base_url):
    soup = BeautifulSoup(html, 'html.parser')
    links = set()
    
    items = soup.find_all('item')
    if items:
        for item in items:
            link_tag = item.find('link')
            if link_tag and link_tag.text:
                links.add(link_tag.text.strip())
        return links

    for a in soup.find_all('a', href=True):
        href = a.get('href', '')
        if '/news/' in href or '/m/' in href or '/articles/' in href:
            full_url = href if href.startswith('http') else base_url.rstrip('/') + '/' + href.lstrip('/')
            links.add(full_url)
    return links

def is_high_value_intel(content):
    if not content:
        return False, "载荷真空"

    content_lower = content.lower()

    FATAL_KEYWORDS = [
        "flagship newsletter", "inboxes every morning", "subscribe to",
        "sign up for", "download the app", "click here to read",
        "all rights reserved", "terms of service", "to read the full article"
    ]
    for word in FATAL_KEYWORDS:
        if word in content_lower:
            return False, f"触碰通用致命词汇 [{word}]"

    if re.search(r'(listen to.*podcast|bloomberg radio|watch live on bloomberg tv)', content_lower):
        return False, "触发 Bloomberg 引流拦截机制"
    if "bloomberg l.p." in content_lower and len(content) < 1000:
        return False, "触发 Bloomberg 极短免责声明拦截机制"
    if re.search(r'(thomson reuters trust principles|compiled by|editing by|our standards:)', content_lower):
        return False, "触发 Reuters 声明拦截机制"
    if re.search(r'(wsj pro|what to read next|listen to the full episode|heard on the street:)', content_lower):
        return False, "触发 WSJ 引流拦截机制"

    if len(content) < 800:
        return False, f"篇幅过短 ({len(content)} 字符)"

    numbers = re.findall(r'\d+', content)
    has_financial_symbols = '%' in content or '$' in content or 'billion' in content_lower or 'million' in content_lower
    
    if len(numbers) < 3 and not has_financial_symbols:
        return False, "数据密度归零"

    return True, "高维资产鉴别通过"

def route_and_extract(url, html):
    for extractor in EXTRACTORS:
        if extractor.match(url):
            return extractor.extract(html)
            
    print("🟡 [模块_异步] -> 目标: 未命中专属契约，执行通用兜底 DOM 撕裂")
    soup = BeautifulSoup(html, 'html.parser')
    for element in soup(["script", "style", "nav", "footer", "aside"]):
        element.decompose()
    return "\n".join([p.get_text(strip=True) for p in soup.find_all('p') if len(p.get_text(strip=True)) > 50])

def main():
    print("==================================================")
    print("      TRUTH DECODER - CORE ENGINE V5.9 SYNC       ")
    print("      [+] 启用流式 JSON 缝合与闪电入库网关...     ")
    print("==================================================")
    
    seen_urls = load_seen_urls()
    all_targets = set()

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
    for url in fresh_targets:
        print(f"🟡 [模块_异步] -> 目标: {url[:60]}...")
        html = fetch_html(url)
        if not html: 
            continue

        try:
            raw_content = route_and_extract(url, html)
        except Exception as e:
            print(f"   🔴 [模块_崩溃] -> 原因: DOM 物理切片异常 ({str(e)})")
            continue

        is_valuable, reject_reason = is_high_value_intel(raw_content)
        if not is_valuable:
            print(f"   🚫 [物理拦截] {reject_reason}")
            save_seen_url(url)
            continue

        # ==========================================
        # 🚀 核心修复区：流式接收 -> 缝合 -> 闪电入库
        # ==========================================
        try:
            print("   🟢 [模块_发起] -> 动作/参数: 呼叫 AI 流式破译引擎...")
            resp = requests.post(
                API_INGEST, 
                json={"rawContent": raw_content}, 
                headers={"Authorization": f"Bearer {INGEST_TOKEN}"},
                stream=True, # 强制以流模式接收
                timeout=60
            )
            
            if resp.status_code != 200:
                print(f"   🔴 [网关拦截] 状态码 {resp.status_code}")
                continue

            print("   🟡 [模块_异步] -> 目标: 正在静默缝合 JSON 碎片...")
            raw_json_string = ""
            for line in resp.iter_lines():
                if line:
                    decoded = line.decode('utf-8').strip()
                    if decoded.startswith('data: ') and not decoded.endswith('[DONE]'):
                        try:
                            data = json.loads(decoded[6:])
                            delta = data.get('choices', [{}])[0].get('delta', {}).get('content', '')
                            raw_json_string += delta
                        except:
                            pass

            # 剥离 Markdown 干扰符
            cleaned_json = raw_json_string.replace('```json', '').replace('```', '').strip()
            first_brace = cleaned_json.find('{')
            last_brace = cleaned_json.rfind('}')
            if first_brace != -1 and last_brace != -1:
                cleaned_json = cleaned_json[first_brace:last_brace+1]

            intel = json.loads(cleaned_json)

            print("   🟢 [模块_发起] -> 动作/参数: 破译完成，请求闪电入库网关...")
            save_resp = requests.post(
                API_SAVE,
                json={"rawContent": raw_content, "intel": intel},
                headers={"Authorization": f"Bearer {INGEST_TOKEN}"},
                timeout=15
            )

            save_data = save_resp.json()
            if save_resp.status_code == 200 and save_data.get('success'):
                signal_id = save_data.get('data', {}).get('signalId', 'UNKNOWN')
                print(f"   🔵 [模块_成功] -> 产物: 致命裁决已落盘！(ID: {signal_id})")
                save_seen_url(url)
                success_count += 1
            else:
                print(f"   🔴 [入库崩溃] -> 原因: {save_data.get('error', '未知错误')}")

        except json.JSONDecodeError:
            print(f"   🔴 [破译崩溃] -> 原因: AI 输出结构严重畸形，抛弃资产")
        except requests.exceptions.Timeout:
            print(f"   🔴 [模块_崩溃] -> 原因: 神经引擎思考/网络传输超时")
        except Exception as e:
            print(f"   🔴 [模块_崩溃] -> 原因: 链路未知阻断 {str(e)[:30]}")
        
        time.sleep(2)

    print("\n==================================================")
    print(f"      🎉 引擎休眠！本次战役成功斩获并入库 {success_count} 条高维资产。")
    print("==================================================")

if __name__ == "__main__":
    main()