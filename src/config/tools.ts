import type { Component } from 'vue'
import {
  BugOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  CodeSandboxOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  NumberOutlined,
  RadarChartOutlined,
} from '@ant-design/icons-vue'

export interface ToolItem {
  key: string
  path: string
  name: string
  shortName: string
  description: string
  icon: Component
}

export const tools: ToolItem[] = [
  {
    key: 'password',
    path: '/password',
    name: '随机密码生成',
    shortName: '密码生成',
    description: '使用浏览器加密随机源生成高强度密码',
    icon: KeyOutlined,
  },
  {
    key: 'date',
    path: '/date-calculator',
    name: '日期计算器',
    shortName: '日期计算',
    description: '计算日期间隔、推算日期与工作日',
    icon: CalendarOutlined,
  },
  {
    key: 'port',
    path: '/random-port',
    name: '随机端口生成',
    shortName: '随机端口',
    description: '在合法范围内批量生成不重复端口',
    icon: NumberOutlined,
  },
  {
    key: 'random-ip',
    path: '/random-ip',
    name: '随机 IP 地址',
    shortName: '随机 IP',
    description: '按类型、网段或起止范围生成随机地址',
    icon: GlobalOutlined,
  },
  {
    key: 'cidr',
    path: '/cidr-calculator',
    name: 'IP 范围计算器',
    shortName: 'IP 范围',
    description: '解析 IPv4 / IPv6 子网、掩码与地址范围',
    icon: DeploymentUnitOutlined,
  },
  {
    key: 'timestamp',
    path: '/timestamp',
    name: '时间戳转换',
    shortName: '时间戳',
    description: '在 Unix 时间戳与日期时间之间快速转换',
    icon: ClockCircleOutlined,
  },
  {
    key: 'ip-info',
    path: '/ip-info',
    name: 'IP 信息查询',
    shortName: 'IP 查询',
    description: '查询 IP 归属地、网络组织与时区信息',
    icon: InfoCircleOutlined,
  },
  {
    key: 'text-editor',
    path: '/text-editor',
    name: '在线文本编辑器',
    shortName: '文本编辑',
    description: '大文本编辑、正则搜索与替换，内容不保存',
    icon: EditOutlined,
  },
  {
    key: 'regex',
    path: '/regex-tester',
    name: '正则表达式测试与编辑',
    shortName: '正则表达式',
    description: '双引擎实时匹配、语法解释、替换提取与测试集',
    icon: CodeOutlined,
  },
  {
    key: 'encoding',
    path: '/text-encoding',
    name: '文本编码转换',
    shortName: '文本编码',
    description: '转换 Base64、URL、Unicode、Hex 等编码',
    icon: CodeOutlined,
  },
  {
    key: 'json',
    path: '/json-formatter',
    name: 'JSON 格式化与树形查看',
    shortName: 'JSON 工具',
    description: '格式化、压缩、校验并展开查看 JSON 数据',
    icon: CodeSandboxOutlined,
  },
  {
    key: 'address',
    path: '/address-generator',
    name: '多国地址生成器',
    shortName: '多国地址',
    description: '生成符合各国格式的虚构地址与测试资料',
    icon: EnvironmentOutlined,
  },
  {
    key: 'nmap',
    path: '/nmap-generator',
    name: 'Nmap 命令生成器',
    shortName: 'Nmap 命令',
    description: '可视化配置目标、扫描方式与输出参数',
    icon: RadarChartOutlined,
  },
  {
    key: 'iperf3',
    path: '/iperf3-generator',
    name: 'iperf3 命令生成器',
    shortName: 'iperf3 命令',
    description: '可视化生成 TCP、UDP 与 SCTP 性能测试命令',
    icon: DashboardOutlined,
  },
  {
    key: 'tcpdump',
    path: '/tcpdump-generator',
    name: 'tcpdump 命令生成器',
    shortName: 'tcpdump 命令',
    description: '可视化生成抓包、pcap 分析与 BPF 过滤命令',
    icon: BugOutlined,
  },
]

export function findTool(path: string) {
  return tools.find((tool) => tool.path === path)
}
