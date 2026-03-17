import os
import re

# ==============================================================================
# 👑 AI 指挥官专属：全栈项目脱水导出 SOP (V2.0 绝对防御版)
# 职责：物理隔离垃圾文件、过滤冗余清单、自动识别并抹除 API 密钥与明文密码
# ==============================================================================

# 1. 全栈垃圾目录隔离区
IGNORE_DIRS = {
    'node_modules', '.next', 'out', 'dist', 'build', '.expo',
    '__pycache__', 'venv', '.venv', 'env', '.pytest_cache',
    'ios', 'android', '.symlinks',
    'target', 'bin', 'pkg', 'vendor',
    '.git', '.vscode', '.idea', 'public', 'static', 'assets'
}

# 2. 核心业务逻辑萃取区
ALLOWED_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html',
    '.py', '.java', '.go', '.rs', '.sql',
    '.json', '.yaml', '.yml', '.md', '.env.example'
}

# 3. 冗余清单与敏感文件狙击区
IGNORE_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 'Gemfile.lock', 'go.sum',
    'export_to_gemini.py', 'gemini_context.txt', 'export_code_sop.py',
    '.env', '.env.local', '.env.production', 'secrets.json'
}

output_file = 'gemini_context.txt'

# 🚀 首席架构师防线：正则脱敏手术刀
def sanitize_content(content):
    # 1. 抹除 OpenAI / DeepSeek / Anthropic 等常见 sk- 密钥
    content = re.sub(r'sk-[a-zA-Z0-9_-]{20,}', '[CENSORED_API_KEY]', content)
    # 2. 抹除带引号的明文密码、Token、Secret (例如 password: "123" 会变成 password: "[CENSORED]")
    pattern = r'(?i)(password|passwd|secret|token|api[_-]?key)[\s:=]+([\'"])[^\'"]+\2'
    content = re.sub(pattern, r'\1 = \2[CENSORED_BY_ARCHITECT]\2', content)
    return content

def should_process(filename):
    if filename in IGNORE_FILES:
        return False
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS

print("🟢 [系统发起] -> 正在挂载全栈项目脱水及脱敏协议...")
count = 0

with open(output_file, 'w', encoding='utf-8') as outfile:
    for root, dirs, files in os.walk('.'):
        # 物理级剔除黑名单文件夹
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        for file in files:
            if should_process(file):
                filepath = os.path.join(root, file)
                outfile.write(f"\n\n{'='*60}\n")
                outfile.write(f"File: {filepath}\n")
                outfile.write(f"{'='*60}\n")
                try:
                    with open(filepath, 'r', encoding='utf-8') as infile:
                        raw_content = infile.read()
                        # 🚨 核心防御：写入前强制进行内容物理脱敏
                        safe_content = sanitize_content(raw_content)
                        outfile.write(safe_content)
                    count += 1
                    print(f"🟡 [扫描提取并脱敏] -> {filepath}")
                except Exception as e:
                    outfile.write(f"[无法读取此文件: {e}]\n")

print(f"\n🔵 [脱水完成] -> 共计处理并脱敏 {count} 个核心逻辑文件。")
print(f"🎯 请在当前目录找到 {output_file} 并发送给大模型。")