import type { Component } from 'vue'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  NumberOutlined,
} from '@ant-design/icons-vue'

export interface ToolItem {
  key: string
  path: string
  name: string
  shortName: string
  description: string
  icon: Component
  color: string
}

export const tools: ToolItem[] = [
  {
    key: 'password',
    path: '/password',
    name: '随机密码生成',
    shortName: '密码生成',
    description: '使用浏览器加密随机源生成高强度密码',
    icon: KeyOutlined,
    color: '#9b5c31',
  },
  {
    key: 'date',
    path: '/date-calculator',
    name: '日期计算器',
    shortName: '日期计算',
    description: '计算日期间隔、推算日期与工作日',
    icon: CalendarOutlined,
    color: '#316b9b',
  },
  {
    key: 'port',
    path: '/random-port',
    name: '随机端口生成',
    shortName: '随机端口',
    description: '在合法范围内批量生成不重复端口',
    icon: NumberOutlined,
    color: '#75602b',
  },
  {
    key: 'random-ip',
    path: '/random-ip',
    name: '随机 IP 地址',
    shortName: '随机 IP',
    description: '按类型、网段或起止范围生成随机地址',
    icon: GlobalOutlined,
    color: '#2d7763',
  },
  {
    key: 'cidr',
    path: '/cidr-calculator',
    name: 'IP 范围计算器',
    shortName: 'IP 范围',
    description: '解析 IPv4 / IPv6 子网、掩码与地址范围',
    icon: DeploymentUnitOutlined,
    color: '#6a56a3',
  },
  {
    key: 'timestamp',
    path: '/timestamp',
    name: '时间戳转换',
    shortName: '时间戳',
    description: '在 Unix 时间戳与日期时间之间快速转换',
    icon: ClockCircleOutlined,
    color: '#a24f59',
  },
  {
    key: 'ip-info',
    path: '/ip-info',
    name: 'IP 信息查询',
    shortName: 'IP 查询',
    description: '查询 IP 归属地、网络组织与时区信息',
    icon: InfoCircleOutlined,
    color: '#447052',
  },
  {
    key: 'encoding',
    path: '/text-encoding',
    name: '文本编码转换',
    shortName: '文本编码',
    description: '转换 Base64、URL、Unicode、Hex 等编码',
    icon: CodeOutlined,
    color: '#496a94',
  },
]

export function findTool(path: string) {
  return tools.find((tool) => tool.path === path)
}
