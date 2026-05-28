import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './config'

export async function uploadFeeReceipt(file, studentId) {
  const path = `receipts/${studentId}/${Date.now()}_${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return await getDownloadURL(storageRef)
}
