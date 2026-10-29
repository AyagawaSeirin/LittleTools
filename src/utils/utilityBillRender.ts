import { billFilename, type UtilityBill } from './utilityBill'
import { drawUtilityBill } from './utilityBillLayouts'
export { escapeBillXml, wrapBillText } from './utilityBillDrawing'

export const BILL_WIDTH = 840
export const BILL_HEIGHT = 1188
export const PHOTO_WIDTH = 1800
export const PHOTO_HEIGHT = 1500

export const renderBillSvg = drawUtilityBill

export function renderBillPhotoSvg(bill: UtilityBill, mainSvg: string) {
  const backgrounds = [['#c9b9a2', '#b09e85'], ['#bdc6c4', '#9caaa7'], ['#c6c2bc', '#a8a39b']]
  const tone = backgrounds[bill.photoTone]
  const documentBody = mainSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}" viewBox="0 0 ${PHOTO_WIDTH} ${PHOTO_HEIGHT}">
    <defs>
      <linearGradient id="desk" x2="1" y2="1"><stop stop-color="${tone[0]}"/><stop offset="1" stop-color="${tone[1]}"/></linearGradient>
      <linearGradient id="light" x2="1" y2="0.6"><stop stop-color="#fff" stop-opacity=".17"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#243030" stop-opacity=".06"/></linearGradient>
      <linearGradient id="fold"><stop stop-color="#000" stop-opacity="0"/><stop offset=".49" stop-color="#000" stop-opacity=".035"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <pattern id="grain" width="135" height="50" patternUnits="userSpaceOnUse"><path d="M0 7L135 5M0 30L135 33" stroke="#fff" opacity=".07"/><path d="M0 47L135 48" stroke="#544c42" opacity=".05"/></pattern>
      <filter id="shadow" x="-25%" y="-25%" width="160%" height="160%"><feDropShadow dx="12" dy="20" stdDeviation="18" flood-opacity=".26"/></filter>
    </defs>
    <rect width="1800" height="1500" fill="url(#desk)"/><rect width="1800" height="1500" fill="url(#grain)"/>
    <g transform="translate(480 145) rotate(${bill.photoAngle} 420 594) skewX(-1.2)">
      <rect width="840" height="1188" fill="#fff" filter="url(#shadow)"/>
      ${documentBody}
      <rect width="840" height="1188" fill="url(#light)"/>
      <rect x="405" width="30" height="1188" fill="url(#fold)"/>
    </g>
  </svg>`
}

export async function rasterizeBill(svg: string, width: number, height: number, type: 'image/png' | 'image/jpeg') {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法生成图片，请更换支持 Canvas 的浏览器')
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('图片导出失败')), type, 0.95))
    // Reclaim the larger bitmap as soon as encoding finishes.
    canvas.width = canvas.height = 0
    return blob
  } finally { URL.revokeObjectURL(url) }
}

export async function createBillPdf(main: Blob, bill: UtilityBill) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title: `${bill.template.issuer} — demonstration`, subject: 'Fictional utility bill demonstration', creator: 'LittleTools' })
  pdf.addImage(new Uint8Array(await main.arrayBuffer()), 'PNG', 0, 0, 210, 297)
  return pdf.output('blob')
}

export async function createBillZip(bill: UtilityBill, main: Blob, photo: Blob, includeMain: boolean, includePhoto: boolean) {
  if (!includeMain && !includePhoto) throw new Error('请至少选择一个下载文件')
  const { zipSync } = await import('fflate')
  const filename = billFilename(bill)
  const files: Record<string, Uint8Array> = {}
  if (includeMain) {
    files[`${filename}.png`] = new Uint8Array(await main.arrayBuffer())
    files[`${filename}.pdf`] = new Uint8Array(await (await createBillPdf(main, bill)).arrayBuffer())
  }
  if (includePhoto) files[`${filename}-photo.jpg`] = new Uint8Array(await photo.arrayBuffer())
  // PNG/JPEG/PDF are already compressed; storing avoids blocking on recompression.
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

export function downloadBillBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
