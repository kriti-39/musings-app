import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import AddStudentModal from '../../components/admin/AddStudentModal'
import { getAllStudentsIncludingInactive, deactivateStudent, reactivateStudent, deleteStudentCompletely } from '../../firebase/db'
import { RiAddLine, RiSearchLine, RiUserLine, RiUserUnfollowLine, RiUserFollowLine, RiDeleteBinLine } from 'react-icons/ri'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'country', label: 'Country' },
  { value: 'createdAt', label: 'Date Joined' },
]

export default function AdminStudents() {
  const [tab, setTab] = useState('active')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')

  async function fetchStudents() {
    setLoading(true)
    const data = await getAllStudentsIncludingInactive()
    setStudents(data)
    setLoading(false)
  }

  useEffect(() => { fetchStudents() }, [])

  const active = students.filter(s => s.isActive !== false)
  const inactive = students.filter(s => s.isActive === false)
  const list = tab === 'active' ? active : inactive

  const filtered = list
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

  async function handleDeactivate(uid) {
    await deactivateStudent(uid)
    fetchStudents()
  }

  async function handleReactivate(uid) {
    await reactivateStudent(uid)
    fetchStudents()
  }

  async function handleDelete(uid, name) {
    if (!window.confirm(`Permanently delete ${name || 'this student'} and all their classes & payments? This cannot be undone.`)) return
    await deleteStudentCompletely(uid)
    fetchStudents()
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Students</h1>
            <p className="text-sm text-gray-400 mt-0.5">{active.length} active · {inactive.length} deactivated</p>
          </div>
          {tab === 'active' && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <RiAddLine size={18} /> Add Student
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
          {[{ key: 'active', label: 'Active' }, { key: 'inactive', label: 'Deactivated' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or country..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading students...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <RiUserLine size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">
              {search ? 'No students match your search.' : tab === 'active' ? 'No active students.' : 'No deactivated students.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Country</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Fee</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, i) => (
                  <tr key={student.id}
                    className={`transition-colors ${tab === 'active' ? 'hover:bg-amber-50 cursor-pointer' : 'opacity-60'} ${i !== filtered.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-800"
                      onClick={() => tab === 'active' && navigate(`/admin/students/${student.id}`)}>
                      {student.name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{student.email}</td>
                    <td className="px-5 py-3.5 text-gray-500">{student.country || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {student.feeAmount ? `₹${student.feeAmount}` : '—'}
                      {student.feeType && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({student.feeType === 'monthly' ? '/mo' : student.feeType === 'per_class' ? '/class' : 'flexible'})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {tab === 'active' ? (
                        <button onClick={() => handleDeactivate(student.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                          <RiUserUnfollowLine size={13} /> Deactivate
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleReactivate(student.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-green-600 border border-green-100 rounded-lg hover:bg-green-50 transition-colors">
                            <RiUserFollowLine size={13} /> Reactivate
                          </button>
                          <button onClick={() => handleDelete(student.id, student.name)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                            <RiDeleteBinLine size={13} /> Delete
                          </button>
                        </div>
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
        <AddStudentModal onClose={() => setShowAdd(false)} onSuccess={fetchStudents} />
      )}
    </AdminLayout>
  )
}
