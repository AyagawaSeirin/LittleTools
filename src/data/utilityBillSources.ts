export interface BillLayoutSource {
  title: string
  url: string
  features: string
  sampleUrl?: string
}

// Public provider/regulator references, checked 2026-10-29. No customer bills are bundled.
export const utilityBillSources: Record<string, BillLayoutSource> = {
  'gb-water': { title: 'Yorkshire Water 账单指南', url: 'https://my.yorkshirewater.com/my-bill/', features: '账户信息、供水与排污费用、账单摘要' },
  'gb-electricity': { title: 'British Gas 官方账单样张', url: 'https://www.britishgas.co.uk/help-and-support/bills-and-payments/view-your-bill', sampleUrl: 'https://www.britishgas.co.uk/aem6/content/dam/britishgas/images/ns/energy/bill-image-1.png', features: '蓝色账户摘要、绿色信息框、底部资费栏' },
  'hk-water': { title: '水务署官方电子账单样张', url: 'https://www.waterconservation.gov.hk/en/at-home/how-to-read-water-bill/index.html', sampleUrl: 'https://www.waterconservation.gov.hk/filemanager/en/content_25/ebill.pdf', features: '双语用水量、黑色用量柱图、蓝色圆角金额框' },
  'hk-electricity': { title: '中电官方账单阅读指南', url: 'https://www.clp.com.hk/zh/residential/bills-payment-tariffs-residential/read-bill', sampleUrl: 'https://www.clp.com.hk/content/dam/clphk/images/1-3/1-3-2/2024/new-tagline/RT%20normal%20bill%20EN_2024_New%20Tagline.pdf', features: '横向费用分项、绿色总额区域、双语读数与用电历史' },
  'au-electricity': { title: 'Alinta Energy 官方账单说明', url: 'https://www.alintaenergy.com.au/help-and-support/help-and-support/billing-and-pricing/how-to-read-your-bill', features: '账户资料、橙色金额摘要、用量与供应费用表' },
  'us-electricity': { title: 'PG&E 官方样例账单', url: 'https://www.pge.com/en/account/billing-and-assistance/understand-your-bill.html', sampleUrl: 'https://www.pge.com/assets/pge/docs/clean-energy/solar/solar-choice-bill-sample.pdf', features: 'Energy Statement 抬头、账户摘要、供电明细、底部回执' },
  'sg-electricity': { title: 'Senoko 官方账单样张', url: 'https://www.senokoenergy.com/households/support/understanding-your-bill', sampleUrl: 'https://www.senokoenergy.com/households/support/-/media/project/senoko-website/households/support/about-your-bill/how-do-I-read-my-bill-01.jpg', features: '青绿色税务账单、右侧账户资料、橙色用量柱图' },
  'ca-electricity': { title: 'BC Hydro 官方账单指南', url: 'https://app.bchydro.com/accounts-billing/bill-payment/bill-details.html?fixZoomMobile=true', sampleUrl: 'https://app.bchydro.com/content/dam/BCHydro/customer-portal/documents/corporate/regulatory-planning-documents/integrated-resource-plans/current-plan/how-to-read-self-generation-bill-winter.pdf', features: '蓝色账单摘要、绿色应付金额、用电趋势' },
  'my-electricity': { title: 'TNB 官方国内账单样张', url: 'https://www.tnb.com.my/residential/billing/', sampleUrl: 'https://www.tnb.com.my/assets/images/sample_bill_domestic_scenario1.png', features: '马来语抬头、粉色金额条、密集费用表、蓝色提示栏' },
  'ph-electricity': { title: 'BENECO 官方计费资料', url: 'https://www.beneco.com.ph/rates.php', features: '合作社抬头、读数表、计费明细、合计与回执；版式为整理重绘' },
  'nz-electricity': { title: '新西兰电力监管机构 Mercury 资料', url: 'https://www.ea.govt.nz/projects/all/improving-consumer-choice/consultation/improving-electricity-billing-in-new-zealand/', sampleUrl: 'https://www.ea.govt.nz/documents/8886/Mercury1.pdf', features: '黄色金额摘要、账期与用量、供电费用明细；版式为整理重绘' },
  'de-electricity': { title: 'Green Planet Energy 官方样例账单', url: 'https://green-planet-energy.de/service/musterrechnung', sampleUrl: 'https://green-planet-energy.de/fileadmin/docs/service/musterrechnung-strom-mit-preisbremse_02.pdf', features: '德文信函式排版、合同号、横向费用表、结算说明' },
  'it-electricity': { title: 'A2A 官方账单阅读指南', url: 'https://www.a2a.it/assistenza/faq/bollette/guida-alla-lettura-bolletta', sampleUrl: 'https://maggiortutela.a2a.it/sites/default/files/NoIndex/maggiortutela/supporto/documenti/contratti/GuidaBolletta/A2A_Guida-EE_tutela.pdf', features: '意大利语、左侧绿色说明栏、灰色金额与截止日期模块' },
  'jp-electricity': { title: 'TEPCO 官方用电通知样张', url: 'https://www.tepco.co.jp/e-rates/individual/shin-ene/saiene/pdf/meter_vote.pdf', features: '日文用电通知、期间与用量并列、料金内訳和计器读数' },
}
