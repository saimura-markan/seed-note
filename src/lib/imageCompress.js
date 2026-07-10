// 画像を長辺1600px程度・JPEGにリサイズ圧縮する（Canvas API、追加ライブラリなし）
export async function compressImage(file, { maxSize = 1600, quality = 0.8 } = {}) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('image compression failed'))),
      'image/jpeg',
      quality
    )
  })
}
