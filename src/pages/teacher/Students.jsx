import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import AddAdminModal from '../../components/teacher/AddAdminModal'
import { getAllStudentsIncludingInactive, getAdmins, deactivateStudent, reactivateStudent, deleteStudentCompletely } from '../../firebase/db'
import { RiSearchLine, RiUserLine, RiAddLine, RiUserUnfollowLine, RiUserFollowLine, RiDeleteBinLine } from 'react-icons/ri'
import ConfirmDialog from '../../components/shared/ConfirmDialog'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'country', label: 'Country' },
  { value: 'createdAt', label: 'Date Joined' },
]

export default function TeacherStudents() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('students')
  const [allStudents, setAllStudents] = useState([])
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try { await deleteStudentCompletely(deleteTarget.id); await fetchAll() }
    catch (e) { console.error('Delete failed:', e) }
    finally { setDeleting(false); setDeleteTarget(null) }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try { await deactivateStudent(deactivateTarget.id); await fetchAll() }
    catch (e) { console.error('Deactivate failed:', e) }
    finally { setDeactivating(false); setDeactivateTarget(null) }
  }

  async function fetchAll() {
    setLoading(true)
    const [s, a] = await Promise.all([getAllStudentsIncludingInactive(), getAdmins()])
    setAllStudents(s)
    setAdmins(a)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const students = allStudents.filter(s => s.isActive !== false)
  const inactiveStudents = allStudents.filter(s => s.isActive === false)

  const filteredStudents = (tab === 'deactivated' ? inactiveStudents : students)
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
    <TeacherLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Users</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {tab === 'students' ? `${students.length} active` : tab === 'deactivated' ? `${inactiveStudents.length} deactivated` : `${admins.length} admins`}
            </p>
          </div>
          {tab === 'admins' && (
            <button onClick={() => setShowAddAdmin(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <RiAddLine size={18} /> Add Admin
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
          {[{k:'students',l:'Students'},{k:'deactivated',l:'Deactivated'},{k:'admins',l:'Admins'}].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.k ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Students / Deactivated tab */}
        {(tab === 'students' || tab === 'deactivated') && (
          <>
            <div className="flex gap-3 mb-5">
              <div className="flex-1 relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email or country..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>Sort: {o.label}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-16">
                <RiUserLine size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">{search ? 'No students match.' : 'No students yet.'}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Name</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Country</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Timezone</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Fee</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, i) => (
                      <tr key={s.id}
                        onClick={() => navigate(`/teacher/students/${s.id}`)}
                        className={`cursor-pointer ${tab === 'deactivated' ? 'opacity-60' : 'hover:bg-amber-50'} transition-colors ${i !== filteredStudents.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <td className="px-5 py-3.5 font-medium text-gray-800">
                          {s.name}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{s.email}</td>
                        <td className="px-5 py-3.5 text-gray-500">{s.country || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-500">{s.timezone || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {s.feeAmount ? `₹${s.feeAmount}` : '—'}
                          {s.feeType && <span className="ml-1 text-xs text-gray-400">({s.feeType === 'monthly' ? '/mo' : s.feeType === 'per_class' ? '/class' : 'flexible'})</span>}
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          {tab === 'students' ? (
                            <button onClick={() => setDeactivateTarget(s)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                              <RiUserUnfollowLine size={13} /> Deactivate
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={async () => { await reactivateStudent(s.id); fetchAll() }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-green-600 border border-green-100 rounded-lg hover:bg-green-50 transition-colors">
                                <RiUserFollowLine size={13} /> Reactivate
                              </button>
                              <button onClick={() => setDeleteTarget(s)}
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
          </>
        )}

        {/* Admins tab */}
        {tab === 'admins' && (
          loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
          ) : admins.length === 0 ? (
            <div className="text-center py-16">
              <RiUserLine size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No admins yet. Add your first admin.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a, i) => (
                    <tr key={a.id} className={i !== admins.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{a.name}</td>
                      <td className="px-5 py-3.5 text-gray-500">{a.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showAddAdmin && (
        <AddAdminModal onClose={() => setShowAddAdmin(false)} onSuccess={fetchAll} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name || 'this student'}?`}
          message="This permanently removes the student and all their data (classes, payments). This cannot be undone."
          confirmLabel="Delete Student"
          variant="danger"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deactivateTarget && (
        <ConfirmDialog
          title={`Deactivate ${deactivateTarget.name || 'this student'}?`}
          message="They won't be able to log in, and their upcoming classes will be cancelled and removed from the schedule. Completed classes and payment history are kept. You can reactivate them later."
          confirmLabel="Deactivate"
          variant="danger"
          loading={deactivating}
          onConfirm={confirmDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </TeacherLayout>
  )
}
