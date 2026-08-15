# LittleTools

一个基于 Vue 3 与 Ant Design Vue 的纯前端浏览器工具箱。它可以直接部署到 GitHub Pages，主要计算都在本地完成，并适配桌面、平板与手机屏幕。

## 已实现工具

- 随机密码生成：字符集、排除字符、长度、批量生成、强度估算与会话历史
- 日期计算器：日期差、完整年月日、工作日、日期向前 / 向后推算
- 随机端口生成：自定义合法端口范围、唯一结果与常见端口速查
- 随机 IP 地址：IPv4 / IPv6、CIDR、起止范围、唯一结果与文本下载
- IP 范围计算器：IPv4 / IPv6 网络范围、掩码、可用范围、PTR 等信息
- 时间戳转换：秒 / 毫秒自动识别、本地时间、UTC、ISO 8601 双向转换
- IP 信息查询：公网 IP 的大致位置、网络组织和时区
- 文本编码转换：Base64、URL、HTML 实体、Unicode、Hex、二进制

全站支持白天 / 黑夜模式、用户自定义主题色和设置持久化。每个工具会在浏览器中独立记住输入参数与选项，下次访问时自动恢复；生成结果和查询结果不会缓存。

## 本地开发

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

运行测试与生产构建：

```bash
npm test
npm run build
npm run preview
```

## 部署到 GitHub Pages

项目已包含 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)。将代码推送到 `main` 分支后：

1. 在 GitHub 仓库打开 **Settings → Pages**。
2. 将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 等待 `Deploy to GitHub Pages` 工作流完成。

站点使用 hash 路由和相对资源路径，因此可部署在用户主页或任意仓库子路径下，不需要额外配置 `base`。

## 数据与隐私

密码、日期、端口、随机 IP、CIDR、时间戳和文本编码均在浏览器本地处理。只有“IP 信息查询”会在用户点击查询后请求第三方服务 [ipwho.is](https://ipwho.is/)；主服务不可用时，指定 IP 会改由 [monip.lws.fr](https://monip.lws.fr/sv/api) 查询。待查询 IP 会发送给实际使用的服务，本项目本身不存储查询内容。

随机密码、端口与 IP 使用浏览器的 `crypto.getRandomValues()`，不使用 `Math.random()`。

## 技术栈

- Vue 3 + TypeScript
- Vite
- Ant Design Vue
- Vue Router
- Vitest

## License

[MIT](LICENSE)
