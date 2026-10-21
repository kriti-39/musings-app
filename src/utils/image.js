// Compress an image File into a JPEG data URL, resized so it stays small enough
// to store directly in Firestore (avoids depending on Firebase Storage).
export function compressImage(file, maxDim = 1100, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = e => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let { width, height } = img
        if (Math.max(width, height) > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        try {
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (err) {
          reject(err)
        }
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// A profile picture, centre-cropped to a square and shrunk hard.
//
// Avatars are always drawn in a circle, so a portrait that isn't square gets
// its sides clipped anyway — cropping here means what you see when you pick the
// photo is what everyone else sees, rather than the browser choosing for you.
//
// 256px at quality 0.7 lands around 15–25KB, which sits comfortably inside a
// Firestore document and loads instantly on a phone.
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
