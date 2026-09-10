import { emptyDocument, exampleDocument, type RegexDocument } from '../utils/regex'
export interface RegexExample { id: string; document: RegexDocument }
const specs: [string, string, string, string, string, string, 'pcre'?][] = [
  ['ipv4', 'IPv4 地址', '\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\b', 'g', '192.168.1.1\n10.0.0.42\n255.255.255.255\n999.1.1.1', '网络, IPv4'],
  ['url', 'HTTP / HTTPS 链接', 'https?:\\/\\/[^\\s<>"\']+', 'gi', '网站 https://example.com/docs?q=regex\nhttp://localhost:8080\nftp://example.com', '链接, URL'],
  ['date', '日期与命名分组', '(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])', 'g', '2026-09-10\n2025-12-31\n2026-99-99', '日期, 命名分组'],
  ['phone', '中国大陆手机号格式', '(?<!\\d)1[3-9]\\d{9}(?!\\d)', 'g', '13800138000\n联系：19912345678\n12345678901', '手机号, 后顾'],
  ['han', '中文汉字', '\\p{Script=Han}+', 'gu', 'Hello 你好！正则表达式 Regex 2026', 'Unicode, 中文'],
  ['numbers', '整数与小数', '-?\\b\\d+(?:\\.\\d+)?\\b', 'g', '温度 -12.5 °C\n数量 42\n价格 19.99', '数字, 小数'],
  ['repeat', '连续重复单词', '\\b(\\w+)\\s+\\1\\b', 'gi', 'hello hello world\nThis is is a test.\nNo repeat here.', '反向引用, 去重'],
  ['log', '日志字段提取', '^\\[(?<time>[^\\]]+)\\]\\s+(?<level>INFO|WARN|ERROR)\\s+(?<message>.+)$', 'gm', '[2026-09-10 12:00:00] INFO Started\n[2026-09-10 12:00:01] ERROR Connection failed\nother text', '日志, 多行'],
  ['color', '十六进制颜色', '#(?:[a-f\\d]{6}|[a-f\\d]{3})\\b', 'gi', 'color: #276b63;\nbackground: #fff;\ninvalid: #12ZZ00;', 'CSS, 颜色'],
  ['password', '密码规则示例', '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d!@#$%^&*]{8,}$', '', 'Abc12345', '前瞻, 校验'],
  ['csv', '简单 CSV 字段', '(?:"(?<quoted>(?:[^"\\r\\n]|"")*)"|(?<plain>[^,"\\r\\n]*))(?:,|$)', 'g', 'one,"two, three",four', 'CSV, 分组'],
  ['pcre-recursion', '成对括号（PCRE 递归）', '\\((?:[^()]|(?R))*\\)', 'gu', 'before (one (two) three) after\n(a)(b)', 'PCRE, 递归', 'pcre'],
  ['pcre-reset', '只提取等号后的值（PCRE）', '\\w+=\\K[^\\s]+', 'gu', 'port=8080 host=localhost debug=true', 'PCRE, 重置起点', 'pcre'],
]
export const regexExamples: RegexExample[] = [
  { id: 'email', document: exampleDocument() },
  ...specs.map(([id, name, pattern, flags, text, tags, engine]): RegexExample => ({ id, document: { ...emptyDocument(), name, pattern, flags, text, tags, engine: engine ?? 'javascript', description: '用于学习和常见文本处理；具体业务规则请结合测试集调整。', replacement: '[$&]' } })),
]
