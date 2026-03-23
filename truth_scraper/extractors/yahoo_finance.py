from bs4 import BeautifulSoup
from .base import BaseExtractor

class YahooFinanceExtractor(BaseExtractor):
    def match(self, url: str) -> bool:
        return "finance.yahoo.com" in url

    def extract(self, html: str) -> str:
        print("🟡 [模块_异步] -> 目标: 挂载 雅虎财经 (Yahoo Finance) 强化版解析策略")
        soup = BeautifulSoup(html, 'html.parser')
        self.clean_soup(soup)

        # 🚀 策略 1：尝试标准容器
        body = soup.find('div', class_='caas-body')
        
        # 🚀 策略 2：如果失败，尝试雅虎另一种常见的正文容器
        if not body:
            body = soup.find('div', class_='body')
            
        # 🚀 策略 3：如果还失败，尝试锁定文章主标签
        if not body:
            body = soup.find('article')

        if body:
            paragraphs = body.find_all('p')
        else:
            # 🚀 策略 4：降级到全网页段落提取，但增加厚度过滤
            print("🔴 [模块_崩溃] -> 原因: 深度容器全部失效，执行暴力段落提取")
            paragraphs = soup.find_all('p')

        # 提高容错性：合并文本，同时过滤掉导航栏等极短的废话
        text_parts = [p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 40]
        text = "\n".join(text_parts)
        
        return text