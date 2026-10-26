// Square-crop and compress a profile picture into a JPEG data URL, small
// enough to store directly in Firestore (no dependency on Firebase Storage).
export function compressAvatar(file, size = 256, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = e => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        // Biggest square that fits, taken from the middle of the photo
        const side = Math.min(img.width, img.height)
        const sx = Math.round((img.width - side) / 2)
        const sy = Math.round((img.height - side) / 2)

        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        // A white base, so a transparent PNG doesn't turn black as JPEG
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

        try { resolve(canvas.toDataURL('image/jpeg', quality)) }
        catch (err) { reject(err) }
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
