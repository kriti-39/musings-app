import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './config'

// Upload a receipt. Filename is sanitized to a safe timestamp + extension
// (the original name may contain spaces/special chars that break the path).
export async function uploadFeeReceipt(file, studentId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `receipts/${studentId}/${Date.now()}.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' })
  return await getDownloadURL(storageRef)
}
