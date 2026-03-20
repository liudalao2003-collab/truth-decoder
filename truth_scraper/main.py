import requests
import urllib3
import json
import re
import time
import os
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from extractors import EXTRACTORS

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 🚀 核心配置区：全域猎场 ---
INDEX_URLS = [
    "https://finance.yahoo.com/topic/stock-market-news/",
    "https://finance.yahoo.com/topic/economic-news/",
    "https://finance.yahoo.com/section/tech/"
]
API_ENDPOINT = "http://localhost:3000/api/v1/ingest" 
INGEST_TOKEN = "ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ="

# 🎯 扩充后的商业硬通货词库 (增强嗅探灵敏度)
BUSINESS_KEYWORDS = [
    "layoff", "job cut", "acquire", "acquisition", "merger", "bankruptcy", 
    "revenue", "profit", "stake", "resign", "restructuring", "buyout",
    "fed", "interest rate", "inflation", "sec", "lawsuit", "crisis", "ai", "nvidia"
]

MEMORY_FILE = "seen_urls.txt"

def load_memory():
    if not os.path.exists(MEMORY_FILE): return set()
    with open(MEMORY_FILE, "r") as f:
        return set(line.strip() for line in f if line.strip())

def save_memory(url):
    with open(MEMORY_FILE, "a") as f:
        f.write(url + "\n")

def normalize_url(url: str) -> str:
    return url.split('?')[0]

def fetch_html(url: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Connection": "keep-alive"
    }
    try:
        session = requests.Session()
        adapter = HTTPAdapter(max_retries=3)
        session.mount("https://", adapter)
        resp = session.get(url, headers=headers, verify=False, timeout=15)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        return ""

def discover_all_articles(index_html: str) -> list:
    soup = BeautifulSoup(index_html, 'html.parser')
    links = soup.find_all('a', href=re.compile(r'/news/.*\.html'))
    return list(set([ (href if href.startswith('http') else f"https://finance.yahoo.com{href}") for link in links if (href := link.get('href')) and 'video' not in href ]))

def validate_intel(text: str) -> bool:
    text_lower = text.lower()
    # 🚨 阈值下放：命中 1 个关键词即视为有价值，确保不漏掉任何线索
    hit_count = sum(1 for keyword in BUSINESS_KEYWORDS if keyword in text_lower)
    return hit_count >= 1 

def main():
    print("==================================================")
    print("      TRUTH DECODER - PRO SCRAPER ENGINE v4.5     ")
    print("      [+] 全域猎场启动 + 嗅探阈值下放             ")
    print("==================================================")
    
    seen_urls = load_memory()
    all_targets = []

    # 1. 执行全域侦察
    for url in INDEX_URLS:
        print(f"🟢 [模块_发起] -> 侦察板块: {url}")
        html = fetch_html(url)
        if html:
            all_targets.extend(discover_all_articles(html))
    
    targets = list(set(all_targets)) # 全局去重
    print(f"🔵 [模块_成功] -> 产物: 全域侦察完毕，共发现 {len(targets)} 个潜在目标")

    # 2. 猎杀循环
    success_count = 0
    for target_url in targets:
        pure_url = normalize_url(target_url)
        if pure_url in seen_urls: continue

        print(f"🟡 [模块_异步] -> 尝试下潜: {pure_url}")
        article_html = fetch_html(pure_url)
        if not article_html: continue

        from extractors import EXTRACTORS
        extractor = next((e for e in EXTRACTORS if e.match(pure_url)), None)
        raw_content = extractor.extract(article_html) if extractor else ""

        if len(raw_content) > 300 and validate_intel(raw_content):
            try:
                resp = requests.post(API_ENDPOINT, json={"rawContent": raw_content}, headers={"Authorization": f"Bearer {INGEST_TOKEN}"}, verify=False)
                if resp.status_code == 200:
                    print(f"🔵 [模块_成功] -> 情报入库成功！")
                    save_memory(pure_url)
                    success_count += 1
                    if success_count >= 3: break # 每次巡航最多抓 3 篇，防止 Token 暴涨
            except: pass
        else:
            save_memory(pure_url) # 无价值的也记下来，防止重复扫描

if __name__ == "__main__":
    main()