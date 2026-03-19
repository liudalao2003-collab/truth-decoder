from bs4 import BeautifulSoup
from .base import BaseExtractor

# 核心业务说明：这是专门针对 Yahoo Finance 的 DOM 结构定制的外科手术刀。
# Yahoo Finance 是一个巨大的聚合器，它的正文通常锁定在特定的 class 中，提取难度极低且收益极高。
class YahooFinanceExtractor(BaseExtractor):
    def match(self, url: str) -> bool:
        """识别是否为雅虎财经的域名"""
        return "finance.yahoo.com" in url

    def extract(self, html: str) -> str:
        print("🟡 [模块_异步] -> 目标: 挂载 雅虎财经 (Yahoo Finance) 专属解析策略")
        soup = BeautifulSoup(html, 'html.parser')
        
        # 呼叫基类的物理级噪音清理防线
        self.clean_soup(soup)

        # 核心逻辑：精准锁定雅虎财经的通用正文容器 (caas-body)
        body = soup.find('div', class_='caas-body')
        
        if not body:
            print("🔴 [模块_崩溃] -> 原因: 未找到 caas-body 容器，启动 DOM 降级全盘扫描")
            paragraphs = soup.find_all('p')
        else:
            paragraphs = body.find_all('p')

        # 过滤掉低于 30 个字符的商业废话（如记者推特链接、版权声明）
        text = "\n".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30])
        return text