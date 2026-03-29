from .reuters import ReutersExtractor
from .wsj import WSJExtractor
from .yahoo_finance import YahooFinanceExtractor
from .bloomberg import BloombergExtractor

# 架构师防线：所有新增的媒体源，必须在此处强制注册进阵列。
# 主程序将按顺序遍历该阵列进行路由匹配。
EXTRACTORS = [
    ReutersExtractor(),
    WSJExtractor(),
    YahooFinanceExtractor(),
    BloombergExtractor() # 🟢 新增：挂载 Bloomberg RSS 降级策略
]