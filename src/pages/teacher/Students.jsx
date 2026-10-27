import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import AddAdminModal from '../../components/teacher/AddAdminModal'
import { getAllStudentsIncludingInactive, getAdmins, deactivateStudent, reactivateStudent, deleteStudentCompletely, getPaymentsByStudent } from '../../firebase/db'
import { lastPaidLabel, lastPaidCredits } from '../../utils/payment'
import { attendance } from '../../utils/studentStats'
import { loadAttendanceMap } from '../../firebase/attendance'
import AttendanceTag from '../../components/shared/AttendanceTag'
import { RiSearchLine, RiUserLine, RiAddLine, RiUserUnfollowLine, RiUserFollowLine, RiDeleteBinLine } from 'react-icons/ri'
import ConfirmDialog from '../../components/shared/ConfirmDialog'
import { displayId } from '../../utils/auth'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'country', label: 'Country' },
  { value: 'attendance', label: 'Regular first' },
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

  // One document holds every student's tag, so the whole list costs a single
  // read rather than one per student.
  const [attMap, setAttMap] = useState({})
  const [payMap, setPayMap] = useState({})

  async function fetchAll() {
    setLoading(true)
    // Five reads for the page, not five per student: credits and payments each
    // come back as one collection and are grouped here.
    const [s, a, att, pays] = await Promise.all([
      getAllStudentsIncludingInactive(), getAdmins(), loadAttendanceMap(),
      getPaymentsByStudent(),
    ])
    setAllStudents(s)
    setAdmins(a)
    setAttMap(att)
    setPayMap(pays)
    setLoading(false)
  }


  useEffect(() => { fetchAll() }, [])

  const students = allStudents.filter(s => s.isActive !== false)
  const inactiveStudents = allStudents.filter(s => s.isActive === false)

  const filteredStudents = (tab === 'deactivated' ? inactiveStudents : students)
    .filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.userId?.toLowerCase().includes(search.toLowerCase()) ||
      s.country?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'country') return (a.country || '').localeCompare(b.country || '')
      if (sortBy === 'attendance') {
        const rank = s => ({ regular: 0, irregular: 1 }[attendance(attMap[s.id]).tag] ?? 2)
        return rank(a) - rank(b) || (a.name || '').localeCompare(b.name || '')
      }
      if (sortBy === 'createdAt') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      return 0
    })

  return (
    <TeacherLayout>
      <div className="max-w-5xl mx-auto">
        {/* Title, count and tabs share one band. They used to be three stacked
            rows, each with its own margin, so the list began some two hundred
            pixels down a phone screen — most of a visible row lost to chrome
            before the first student. The count moves inline because the tab it
            belongs to is now right beside it. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
          <h1 className="text-xl font-semibold text-gray-800">
            Users
            <span className="ml-2 text-sm font-normal text-gray-400">
              {tab === 'students' ? `${students.length} active` : tab === 'deactivated' ? `${inactiveStudents.length} deactivated` : `${admins.length} admins`}
            </span>
          </h1>

          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {[{k:'students',l:'Students'},{k:'deactivated',l:'Inactive'},{k:'admins',l:'Admins'}].map(t => (
                <button key={t.k} onClick={() => setTab(t.k)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    tab === t.k ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {t.l}
                </button>
              ))}
            </div>
            {tab === 'admins' && (
              <button onClick={() => setShowAddAdmin(true)}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                <RiAddLine size={15} /> Add Admin
              </button>
            )}
          </div>
        </div>

        {/* Students / Deactivated tab */}
        {(tab === 'students' || tab === 'deactivated') && (
          <>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search students"
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
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Category</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Country</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Timezone</th>
                      {/* No standing fee here — on credits there is none to
                          quote. What is worth seeing beside a student is whether
                          money came in lately and what they have left to book
                          with. */}
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Last paid / Credits</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, i) => (
                      <tr key={s.id}
                        onClick={() => navigate(`/teacher/students/${s.id}`)}
                        className={`cursor-pointer ${tab === 'deactivated' ? 'opacity-60' : 'hover:bg-amber-50'} transition-colors ${i !== filteredStudents.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <td className="px-5 py-3.5 font-medium text-gray-800">{s.name}</td>
                        {/* Guruji sets this as well as the office. He is the one
                            who notices a student drifting, and it is always
                            shown — including before there are enough classes for
                            the arithmetic to judge. */}
                        <td className="px-5 py-3.5">
                          <AttendanceTag student={s} meta={attMap[s.id]}
                            onChange={fetchAll} editable />
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{s.country || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-500">{s.timezone || '—'}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="block text-gray-700">
                            {lastPaidLabel(payMap[s.id]) || '—'}
                          </span>
                          <span className="block text-[11px] text-gray-400">
                            {lastPaidCredits(payMap[s.id]) || ''}
                          </span>
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
                      <td className="px-5 py-3.5 text-gray-500">{displayId(a)}</td>
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
