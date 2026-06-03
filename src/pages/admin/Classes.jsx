import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/admin/AdminLayout'
import ClassList from '../shared/ClassList'

export default function AdminClasses() {
  const { user } = useAuth()
  return <ClassList teacherId={user?.id} Layout={AdminLayout} />
}
