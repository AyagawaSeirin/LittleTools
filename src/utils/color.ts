function channels(color: string) {
  return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16))
}

function luminance(rgb: number[]) {
  return rgb.reduce((sum, channel, index) => {
    const value = channel / 255
    return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]
  }, 0)
}

export function contrastingText(color: string) {
  return luminance(channels(color)) > 0.179 ? '#000000' : '#ffffff'
}

// Keep custom accent text readable on both page and panel surfaces.
export function readableAccent(color: string, dark: boolean) {
  const rgb = channels(/^#[\da-f]{6}$/i.test(color) ? color : '#276b63')
  const background = luminance(dark ? [32, 38, 34] : [243, 245, 242])
  for (let step = 0; step <= 20; step += 1) {
    const mixed = rgb.map((channel) => Math.round(channel + ((dark ? 255 : 0) - channel) * step / 20))
    const foreground = luminance(mixed)
    if ((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) >= 4.5) {
      return `rgb(${mixed.join(', ')})`
    }
  }
  return dark ? '#ffffff' : '#000000'
}
