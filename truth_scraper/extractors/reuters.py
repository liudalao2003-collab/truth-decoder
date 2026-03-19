from bs4 import BeautifulSoup
from .base import BaseExtractor

class ReutersExtractor(BaseExtractor):
    def match(self, url: str) -> bool:
        return "reuters.com" in url

    def extract(self, html: str) -> str:
        print("🟡 [模块_异步] -> 目标: 挂载 路透社 (Reuters) 专属解析策略")
        soup = BeautifulSoup(html, 'html.parser')
        self.clean_soup(soup)

        # 锁定路透社的核心新闻容器，防止旁路侧边栏的新闻标题污染事实数据
        article = soup.find('article')
        if not article:
            # 如果没找到标准 article 标签，降级处理
            paragraphs = soup.find_all('p')
        else:
            paragraphs = article.find_all('p')

        # 过滤掉低于 30 个字符的无意义短句（如图片来源声明、记者名字）
        text = "\n".join([p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30])
        return text