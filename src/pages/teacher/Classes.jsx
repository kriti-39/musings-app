import { useAuth } from '../../context/AuthContext'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import ClassList from '../shared/ClassList'

export default function TeacherClasses() {
  const { user } = useAuth()
  return <ClassList teacherId={user?.id} Layout={TeacherLayout} />
}
