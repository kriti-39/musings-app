import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import AddStudentModal from '../../components/admin/AddStudentModal'
import { getAllStudents } from '../../firebase/db'
import { RiAddLine, RiSearchLine, RiUserLine } from 'react-icons/ri'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'country', label: 'Country' },
  { value: 'createdAt', label: 'Date Joined' },
]

export default function AdminStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')

  async function fetchStudents() {
    setLoading(true)
    const data = await getAllStudents()
    setStudents(data)
    setLoading(false)
  }

  useEffect(() => { fetchStudents() }, [])

  const filtered = students
    .filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.country?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'country') return (a.country || '').localeCompare(b.country || '')
      if (sortBy === 'createdAt') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      return 0
    })

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Students</h1>
            <p className="text-sm text-gray-400 mt-0.5">{students.length} total</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RiAddLine size={18} />
            Add Student
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or country..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>Sort: {o.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading students...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <RiUserLine size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">
              {search ? 'No students match your search.' : 'No students yet. Add your first student.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Country</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Timezone</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Fee</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, i) => (
                  <tr
                    key={student.id}
                    onClick={() => navigate(`/admin/students/${student.id}`)}
                    className={`hover:bg-amber-50 cursor-pointer transition-colors ${i !== filtered.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-800">{student.name}</td>
                    <td className="px-5 py-3.5 text-gray-500">{student.email}</td>
                    <td className="px-5 py-3.5 text-gray-500">{student.country || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500">{student.timezone || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {student.feeAmount ? `₹${student.feeAmount}` : '—'}
                      {student.feeType && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({student.feeType === 'monthly' ? '/mo' : student.feeType === 'per_class' ? '/class' : 'flexible'})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddStudentModal
          onClose={() => setShowAdd(false)}
          onSuccess={fetchStudents}
        />
      )}
    </AdminLayout>
  )
}
