import requests
import urllib3
import json
import re
from bs4 import BeautifulSoup
from extractors import EXTRACTORS

# 物理级静音：屏蔽强制绕过 SSL 时产生的警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 核心配置区 ---
# 目标：雅虎财经新闻主页
INDEX_URL = "https://finance.yahoo.com/news/" 
API_ENDPOINT = "http://localhost:3000/api/v1/ingest" 
INGEST_TOKEN = "ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ="

def get_extractor(url: str):
    """遍历策略阵列，动态分发提取器"""
    for ext in EXTRACTORS:
        if ext.match(url):
            return ext
    return None

def fetch_html(url: str) -> str:
    """发起物理网络请求，获取网页源码"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
    }
    try:
        session = requests.Session()
        resp = session.get(url, headers=headers, verify=False, timeout=15)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: 物理连接阻断 - {str(e)}")
        return ""

def discover_first_article(index_html: str) -> str:
    """
    核心侦察逻辑：
    从雅虎财经新闻列表页中，嗅探出第一个符合格式的文章链接。
    """
    print("🟡 [模块_异步] -> 目标: 正在执行目录侦察，寻找高价值情报入口...")
    soup = BeautifulSoup(index_html, 'html.parser')
    
    # 策略：寻找所有包含 '/news/' 且以 '.html' 结尾的 <a> 标签
    links = soup.find_all('a', href=re.compile(r'/news/.*\.html'))
    
    for link in links:
        href = link.get('href')
        if not href: continue
        
        # 补全 URL 协议头
        full_url = href if href.startswith('http') else f"https://finance.yahoo.com{href}"
        
        # 排除包含 'video' 字样的页面，因为视频页面缺乏文本深度
        if 'video' not in full_url:
            print(f"🔵 [模块_成功] -> 产物: 发现最新头条情报源: {full_url}")
            return full_url
            
    return ""

def main():
    print("==================================================")
    print("      TRUTH DECODER - PRO SCRAPER ENGINE v3.2     ")
    print("==================================================")
    
    # 1. 目录侦察
    print(f"🟢 [模块_发起] -> 动作/参数: 潜入目录页 {INDEX_URL}")
    index_html = fetch_html(INDEX_URL)
    if not index_html: return

    # 2. 锁定目标文章
    target_article_url = discover_first_article(index_html)
    if not target_article_url:
        print("🔴 [模块_崩溃] -> 原因: 目录侦察失败，未发现有效文章链接")
        return

    # 3. 二次下潜：获取文章正文
    print(f"🟢 [模块_发起] -> 动作/参数: 执行二次下潜，目标: {target_article_url}")
    article_html = fetch_html(target_article_url)
    
    # 4. 物理洗稿
    extractor = get_extractor(target_article_url)
    if extractor:
        raw_content = extractor.extract(article_html)
    else:
        # 降级方案
        soup = BeautifulSoup(article_html, 'html.parser')
        raw_content = "\n".join([p.get_text(strip=True) for p in soup.find_all('p') if len(p.get_text(strip=True)) > 50])
    
    if len(raw_content) < 300:
        print(f"🔴 [模块_崩溃] -> 原因: 情报厚度不足 ({len(raw_content)} 字符)，强制阻断注入")
        return
        
    print(f"🔵 [模块_成功] -> 产物: 高密度文本清洗完毕, 长度: {len(raw_content)}")
    
    # 5. 跨栈发射至 Next.js
    print(f"🟡 [模块_异步] -> 目标: 将截获的头条情报泵入 DeepSeek 引擎...")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {INGEST_TOKEN}"
    }
    try:
        resp = requests.post(API_ENDPOINT, json={"rawContent": raw_content}, headers=headers, verify=False)
        result = resp.json()
        if resp.status_code == 200 and result.get("success"):
            print(f"🔵 [模块_成功] -> 产物: 最新头条已解码入库!")
            print(f"🔗 访问地址: http://localhost:3000/decode/{result['data']['signalId']}")
        else:
            print(f"🔴 [模块_崩溃] -> 原因: 后端网关拒绝注入 - {result.get('error')}")
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: 链路断裂 - {str(e)}")

if __name__ == "__main__":
    main()