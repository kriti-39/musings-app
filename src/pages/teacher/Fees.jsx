import { useState, useEffect } from 'react'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { getAllStudents, getStudentPayments, confirmPayment } from '../../firebase/db'
import { useAuth } from '../../context/AuthContext'
import { RiCheckLine } from 'react-icons/ri'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(m) {
  const [y, mo] = m.split('-')
  return `${MONTHS[parseInt(mo) - 1]} ${y}`
}

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function TeacherFees() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState({})
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const allStudents = await getAllStudents()
      setStudents(allStudents)
      const map = {}
      await Promise.all(allStudents.map(async s => {
        map[s.id] = await getStudentPayments(s.id)
      }))
      setPayments(map)
      setLoading(false)
    }
    fetch()
  }, [])

  function getStatus(studentId, month) {
    const list = payments[studentId] || []
    const found = list.find(p => p.months?.includes(month))
    if (!found) return 'unpaid'
    return found.status === 'confirmed' ? 'paid' : 'pending'
  }

  function getPayment(studentId, month) {
    return (payments[studentId] || []).find(p => p.months?.includes(month))
  }

  async function handleConfirm(paymentId, studentId) {
    await confirmPayment(paymentId, user.id, studentId)
    const allStudents = await getAllStudents()
    const map = {}
    await Promise.all(allStudents.map(async s => { map[s.id] = await getStudentPayments(s.id) }))
    setPayments(map)
  }

  const months = []
  for (let i = -2; i <= 2; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const paid = students.filter(s => getStatus(s.id, selectedMonth) === 'paid').length
  const pending = students.filter(s => getStatus(s.id, selectedMonth) === 'pending').length
  const unpaid = students.filter(s => getStatus(s.id, selectedMonth) === 'unpaid').length

  return (
    <TeacherLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-800 mb-3">Fees</h1>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {months.map(m => (
              <button key={m} onClick={() => setSelectedMonth(m)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedMonth === m ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300'
                }`}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Paid', value: paid, color: 'text-green-600' },
            { label: 'Pending Confirmation', value: pending, color: 'text-amber-600' },
            { label: 'Unpaid', value: unpaid, color: 'text-red-500' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-16">Loading...</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Country</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">{monthLabel(selectedMonth)}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const status = getStatus(s.id, selectedMonth)
                  const payment = getPayment(s.id, selectedMonth)
                  return (
                    <tr key={s.id}
                      className={`transition-colors ${i !== students.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-800">{s.name}</td>
                      <td className="px-5 py-3.5 text-gray-500">{s.country || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          status === 'paid' ? 'bg-green-50 text-green-700' :
                          status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-500'
                        }`}>
                          {status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending confirmation' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {status === 'pending' && payment && (
                          <button onClick={() => handleConfirm(payment.id, s.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs hover:bg-green-100 transition-colors">
                            <RiCheckLine size={13} /> Confirm
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TeacherLayout>
  )
}
