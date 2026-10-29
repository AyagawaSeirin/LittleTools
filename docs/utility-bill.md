# 账单生成检查记录

检查日期：2026-10-29。入口：`/#/utility-bill`。

## 范围

参考 Windx Make 的制作流程，在现有 Vue 3 工具箱内实现 12 国、14 个模板的本地生成器，名称统一为「账单生成」。新版采用 14 套独立布局，参照公开服务商样张或计费资料重绘，包含真实机构名称作为来源标识。选择模板时展示实际渲染缩略图、版式特点和原始参考链接。

主图为 2480 × 3508 像素 PNG；实拍模拟图为 3000 × 2500 像素 JPG，由同一份账单内容加入纸张、桌面、光照及阴影绘制。版式由矢量文字、表格和图表直接绘制，图片没有覆盖式水印和模糊滤镜，页眉和页脚有示例说明。PDF 内嵌原分辨率主图，输出 A4 单页。ZIP 可按选项包含 PNG + PDF、JPG 或全部文件。

## 自动化检查

`npm test`：7 个测试文件、135 项测试通过，其中账单专项 20 项。覆盖所有模板的邮编格式、账期间隔、表读数差、用量与单价乘积、明细合计、日元最小单位、随机变化、输入校验、全部 14 种版式的最长地址排版、版式差异、来源记录与 SVG 文本转义。

`npm run build`：Vue/TypeScript 检查及生产构建通过。账单页面、PDF 和 ZIP 依赖按需加载；构建生成的离线清单包含这些资源。

## 浏览器实测

- 逐一切换 12 个国家并生成全部 14 个模板，主图均为 2480 × 3508 像素，没有控制台错误。
- PNG 的 `naturalWidth`、`naturalHeight` 和文件头尺寸均为 2480 × 3508，图片 CSS `filter` 为 `none`；实拍图为 3000 × 2500。
- 单独 PNG、PDF 下载成功；PDF 文件头有效，单页，MediaBox 为 A4，内嵌图片为 2480 × 3508。
- 全选 ZIP 解压校验通过，包含 PNG、PDF 和 JPG；其中 PNG 字节与单独下载完全一致。仅选实拍图时 ZIP 只包含 JPG；两项均未选时禁止打包。
- 中文姓名与无效邮编显示错误；全大写按钮有效；手动填写、自动填充和重新生成可用。修改表单后显示旧预览提示。
- 刷新恢复国家、模板及输入参数，生成结果清空；下载按钮随结果状态禁用。
- 本轮实测 380、1280 像素视口未出现页面横向溢出；手机切换为单列；明暗主题可用；放大预览和原始尺寸切换可用。

新增版式检查：14 种模板的 SVG 文字边界测量未发现页面越界或相互重叠。新版水务署样式的 PDF 经渲染检查无裁切，ZIP 的 CRC 校验通过；PNG 为 2480 × 3508，JPG 为 3000 × 2500，PDF 为单页 A4 且内嵌 2480 × 3508 图片。

截图：[14 种版式](screenshots/utility-bill/styles.jpg)、[桌面](screenshots/utility-bill/desktop.jpg)、[手机](screenshots/utility-bill/mobile.jpg)、[深色主题](screenshots/utility-bill/dark.jpg)。

## 实现说明

- 表单、国家元数据和随机账单模型位于 `src/utils/utilityBill.ts`。
- 14 套 SVG 排版位于 `src/utils/utilityBillLayouts.ts`，文字换行与绘图基础方法位于 `src/utils/utilityBillDrawing.ts`。
- 高清栅格化和 PDF、ZIP 导出位于 `src/utils/utilityBillRender.ts`。
- 版式参考来源和特征说明位于 `src/data/utilityBillSources.ts`。
- 页面与异步状态管理位于 `src/views/UtilityBillView.vue`；切换国家或离开页面后，旧异步任务不能覆盖新选择。
- 字符串先转义再写入 SVG；长地址自动换行并在必要时缩小字体。原图由浏览器 Canvas 直接编码，下载不依赖屏幕截图。
- 国家地址包沿用现有缓存机制，首次使用需要加载；生成过程不上传表单或文档。

`npm audit` 当前仍报告仓库原有 Vue/Vite/Vitest 等依赖的 7 条告警，新增 jsPDF 与 fflate 未被列为告警来源；本次没有进行无关的跨版本依赖升级。


## 公开版式参考

使用服务商、公共机构公开发布的样例和账单阅读指南，不收集客户账单。已实际查看 British Gas、香港水务署、Senoko、TNB、Green Planet Energy、A2A 的公开图片或 PDF。部分原始样张自带教学标注或示例字样，未修改或去除原始图片上的标识，也没有把这些图片放入项目。输出由本地 SVG 重绘生成；机构标志使用文字表达，不声称是官方账单原稿或逐像素复刻。

| 模板 | 公开参考 | 采用的版式特征 |
| --- | --- | --- |
| Yorkshire Water | [账单指南](https://my.yorkshirewater.com/my-bill/) | 账户资料、供水及排污费用、账单摘要 |
| British Gas | [官方账单样张](https://www.britishgas.co.uk/aem6/content/dam/britishgas/images/ns/energy/bill-image-1.png) | 问候语、蓝色账户摘要、绿色信息框、底部资费 |
| 香港水务署 | [电子账单 PDF](https://www.waterconservation.gov.hk/filemanager/en/content_25/ebill.pdf) | 双语字段、黑色用量柱图、蓝色圆角金额框 |
| 中电 CLP | [阅读账单](https://www.clp.com.hk/zh/residential/bills-payment-tariffs-residential/read-bill) | 横向费用分项、绿色总额、双语读数 |
| Alinta Energy | [账单指南](https://www.alintaenergy.com.au/help-and-support/help-and-support/billing-and-pricing/how-to-read-your-bill) | 橙色金额摘要、紫色账户资料、用量费用 |
| PG&E | [官方样例 PDF](https://www.pge.com/assets/pge/docs/clean-energy/solar/solar-choice-bill-sample.pdf) | Energy Statement、账户摘要、供电明细 |
| Senoko Energy | [官方样张](https://www.senokoenergy.com/households/support/-/media/project/senoko-website/households/support/about-your-bill/how-do-I-read-my-bill-01.jpg) | 青绿抬头、右侧资料、橙色用量图 |
| BC Hydro | [账单说明](https://app.bchydro.com/accounts-billing/bill-payment/bill-details.html?fixZoomMobile=true) | 蓝色账单摘要、绿色金额、用电趋势 |
| TNB | [国内账单样张](https://www.tnb.com.my/assets/images/sample_bill_domestic_scenario1.png) | 马来语、粉色金额条、密集表格、蓝色提示栏 |
| BENECO | [计费资料](https://www.beneco.com.ph/rates.php) | 合作社抬头、读数和计算表；整理重绘 |
| Mercury | [监管机构账单咨询资料](https://www.ea.govt.nz/projects/all/improving-consumer-choice/consultation/improving-electricity-billing-in-new-zealand/) | 黄色金额摘要、账期、用量和供电费用；整理重绘 |
| Green Planet Energy | [样例账单 PDF](https://green-planet-energy.de/fileadmin/docs/service/musterrechnung-strom-mit-preisbremse_02.pdf) | 德文信函、合同号、费用表、结算说明 |
| A2A Energia | [账单指南 PDF](https://maggiortutela.a2a.it/sites/default/files/NoIndex/maggiortutela/supporto/documenti/contratti/GuidaBolletta/A2A_Guida-EE_tutela.pdf) | 意大利语、绿色侧栏、灰色金额与日期框 |
| TEPCO | [用电通知 PDF](https://www.tepco.co.jp/e-rates/individual/shin-ene/saiene/pdf/meter_vote.pdf) | 日文通知、期间与用量、料金内訳、计器读数 |

参考资料的公开地址可能调整，部分站点限制自动下载；BENECO、Mercury 未取得可完整核对的原始账单图片，其版式为根据公开资料整理的示例。所有金额、账期、读数均为演示数据，不对应服务商实际资费规则。
