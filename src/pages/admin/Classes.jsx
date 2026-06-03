import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/admin/AdminLayout'
import ClassList from '../shared/ClassList'

export default function AdminClasses() {
  return <ClassList showAll Layout={AdminLayout} />
}
