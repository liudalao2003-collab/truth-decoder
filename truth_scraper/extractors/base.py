from abc import ABC, abstractmethod
from bs4 import BeautifulSoup

# 核心业务说明：所有专属媒体提取器必须严格遵守此契约
class BaseExtractor(ABC):
    @abstractmethod
    def match(self, url: str) -> bool:
        """判定当前提取器是否负责处理该 URL"""
        pass

    @abstractmethod
    def extract(self, html: str) -> str:
        """执行定制化的 DOM 树切割"""
        pass

    def clean_soup(self, soup: BeautifulSoup):
        """通用物理噪音剔除防线，彻底粉碎广告与追踪脚本"""
        for element in soup(["script", "style", "nav", "footer", "aside", "iframe", "noscript"]):
            element.decompose()