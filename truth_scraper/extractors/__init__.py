from .reuters import ReutersExtractor
from .wsj import WSJExtractor
from .yahoo_finance import YahooFinanceExtractor

# 架构师防线：所有新增的媒体源，必须在此处注册进阵列，主程序将自动遍历匹配
EXTRACTORS = [
    ReutersExtractor(),
    WSJExtractor(),
    YahooFinanceExtractor() # 🟢 新增：挂载雅虎财经策略
]