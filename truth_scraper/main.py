import requests
from bs4 import BeautifulSoup
import urllib3

# 物理级静音：屏蔽强制绕过 SSL 时产生的烦人控制台警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 核心业务说明：这是 TruthDecoder 的物理级情报抓取触手。
# 它的作用是去目标商业网站剥离 HTML 伪装，提取纯净的文本通稿，为后续打入深层解码引擎做准备。

def fetch_html(url: str) -> str:
    """
    目标：发起物理网络请求，获取网页源码。
    """
    print(f"🟢 [模块_发起] -> 动作/参数: 开始潜入目标节点 {url}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        print(f"🟡 [模块_异步] -> 目标: 等待目标服务器下发数据...")
        # 🚨 战术降级：注入 verify=False，无视本地缺失的 SSL 证书链，强行建立连接
        response = requests.get(url, headers=headers, timeout=10, verify=False)
        response.raise_for_status() 
        
        print(f"🔵 [模块_成功] -> 产物: 成功获取 HTML 源码，体积 {len(response.text)} 字节")
        return response.text
    except Exception as e:
        print(f"🔴 [模块_崩溃] -> 原因: 网络请求阻断 - {e}")
        return ""

def extract_article_text(html: str) -> str:
    """
    目标：使用 BeautifulSoup 解析 DOM 树，只提取核心正文。
    """
    if not html:
        return ""

    print(f"🟡 [模块_异步] -> 目标: 执行 HTML 结构清洗与噪音剥离")
    soup = BeautifulSoup(html, 'html.parser')

    paragraphs = soup.find_all('p')
    article_text = "\n".join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])

    print(f"🔵 [模块_成功] -> 产物: 纯净文本清洗完毕，有效字符数 {len(article_text)}")
    return article_text

def main():
    # 测试靶机
    target_url = "https://example.com" 

    html_content = fetch_html(target_url)
    raw_text = extract_article_text(html_content)

    if raw_text:
        print("\n================ [截获的原始通稿] ================")
        print(raw_text[:300] + "\n...(截断显示)")
        print("==================================================\n")
    else:
        print("🔴 [模块_崩溃] -> 原因: 未能提取到有效情报文本")

if __name__ == "__main__":
    main()