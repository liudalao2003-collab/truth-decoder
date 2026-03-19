from bs4 import BeautifulSoup
from .base import BaseExtractor

class WSJExtractor(BaseExtractor):
    def match(self, url: str) -> bool:
        return "wsj.com" in url

    def extract(self, html: str) -> str:
        print("🟡 [模块_异步] -> 目标: 挂载 华尔街日报 (WSJ) 专属解析策略")
        soup = BeautifulSoup(html, 'html.parser')
        self.clean_soup(soup)

        # WSJ 的前导段落通常包含最核心的商业硬通货，过滤极短的版权声明
        paragraphs = soup.find_all('p')
        text = "\n".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30])
        return text