from bs4 import BeautifulSoup
from .base import BaseExtractor

class BloombergExtractor(BaseExtractor):
    """
    核心业务说明：
    Bloomberg 专属 RSS 降级解析器。
    鉴于其高强度的反爬物理护城河，我们彻底放弃直连 HTML，
    专攻其 RSS feed 返回的纯净 XML description / content 字段。
    """
    def match(self, url: str) -> bool:
        return "bloomberg.com" in url

    def extract(self, html: str) -> str:
        print("🟡 [模块_异步] -> 目标: 挂载 Bloomberg (RSS 降级) 专属解析策略")
        soup = BeautifulSoup(html, 'html.parser')
        
        # 物理切割不需要的杂质
        self.clean_soup(soup)

        # RSS 中的正文通常包裹在 CDATA 或段落中，直接提取全量净文本
        paragraphs = soup.find_all('p')
        if paragraphs:
            text = "\n".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20])
        else:
            text = soup.get_text(separator='\n', strip=True)
            
        return text