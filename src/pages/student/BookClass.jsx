import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import StudentLayout from '../../components/student/StudentLayout'
import CreditBalance from '../../components/student/CreditBalance'
import TimePickerSheet from '../../components/student/TimePickerSheet'
import { useAuth } from '../../context/AuthContext'
import {
  getBookingMonth, createBooking, getTeacher, BOOKING_WINDOW_DAYS,
} from '../../firebase/db'
import { usesCredits } from '../../utils/credits'
import {
  windowsForLocalDay, localDayPieces, localFreeRanges, localDayStatus,
  withinBookingWindow, fmtRangeLabel, describeRange, rangeIsBookable,
} from '../../utils/availability'
import {
  LOCAL_TZ, fmtTime12, fmtLongDate, sameCalendarDay, fmtDayInTz,
} from '../../utils/timezone'
import {
  RiArrowLeftSLine, RiArrowRightSLine, RiCalendarLine, RiCheckLine,
  RiCloseLine, RiErrorWarningLine, RiLayoutGridLine, RiListUnordered,
  RiLock2Line, RiTimeLine,
} from 'react-icons/ri'

// ─── Booking, the right way round ────────────────────────────────────────────
// The old screen drew what was BUSY. One class at 5pm put a red block on the
// day, so a month with a dozen classes in it looked shut, and the only way to
// learn otherwise was to open each day. Students stopped trying.
//
// This one draws what is AVAILABLE. The studio teaches a known window; whatever
// is not booked or blocked inside it is free, and a day is open unless
// something makes it otherwise. Only two things close a day: every slot in it
// is taken, or Guruji marked it unavailable.
//
// Free time is shown as RANGES, not as a list of hours. An eighteen-hour
// teaching day with four classes in it is fourteen free hours — as a list that
// is fourteen things to read past, as ranges it is five lines. Tapping one
// opens the clock, so 3:30 and 4:15 are as easy to pick as 3:00; offering
// preset start times would quietly put the hour back as the only real choice.
//
// The arithmetic behind all of this — windows, timezones, the gaps between
// classes — lives in utils/availability.js, where it is tested without a
// browser. This file only arranges it on screen.
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function keyOf(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function BookClass() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [teacher, setTeacher] = useState(null)
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() } })
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [dayKey, setDayKey] = useState(null)        // null = the month
  const [dayView, setDayView] = useState('grid')
  const [picking, setPicking] = useState(null)      // the range being timed
  const [chosen, setChosen] = useState(null)        // { start, duration }
  const [working, setWorking] = useState(false)
  const [bookError, setBookError] = useState('')
  const [credits, setCredits] = useState(null)
  const [reload, setReload] = useState(0)
  // Fixed at the moment the data arrived, not read fresh on every render.
  // "Is this range still bookable?" must give the same answer throughout one
  // paint, or a range can vanish between being listed and being tapped.
  const [now, setNow] = useState(() => new Date())

  const displayTz = user?.timezone || LOCAL_TZ
  const onCredits = usesCredits(user)
  const outOfCredits = onCredits && credits === 0

  useEffect(() => { getTeacher().then(setTeacher).catch(() => setTeacher(null)) }, [])

  const load = useCallback(() => setReload(n => n + 1), [])

  const teacherId = teacher?.id
  const teacherZone = teacher?.timezone || 'Asia/Kolkata'
  const studentId = user?.id

  useEffect(() => {
    if (!teacherId || !studentId) return
    let live = true
    getBookingMonth(teacherId, studentId, cursor.y, cursor.m, teacherZone)
      .then(d => {
        if (!live) return
        setData(d)
        setNow(new Date())
        setLoadError(null)
      })
      .catch(e => {
        if (!live) return
        console.error('Booking calendar failed to load:', e)
        setLoadError(
          e?.code === 'failed-precondition'
            ? 'A database index is still building. Give it a minute and refresh.'
            : 'Could not load the calendar. Please try again.',
        )
      })
    return () => { live = false }
  }, [teacherId, studentId, teacherZone, cursor.y, cursor.m, reload])

  const teacherTz = data?.teaching?.timezone || 'Asia/Kolkata'
  const teaching = data?.teaching?.hours

  // ─── The month, one word per day ───────────────────────────────────────────
  const days = useMemo(() => {
    if (!data) return []
    const first = new Date(cursor.y, cursor.m, 1)
    const total = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const mineByDay = new Set(
      data.mine.map(c => c.start.toLocaleDateString('en-CA', { timeZone: displayTz })),
    )

    const out = []
    for (let i = 0; i < first.getDay(); i++) out.push({ blank: true, key: `b${i}` })
    for (let d = 1; d <= total; d++) {
      const key = keyOf(cursor.y, cursor.m, d)
      const windows = windowsForLocalDay(key, teaching, teacherTz, displayTz)
      let status = localDayStatus({ windows, busy: data.busy, blocked: data.blocked, now })
      // A day further out than students may book is not refused, it simply has
      // not opened yet — a different thing, and worth saying differently.
      if (status === 'available' && !windows.some(w => withinBookingWindow(w, now, BOOKING_WINDOW_DAYS))) {
        status = 'later'
      }
      out.push({ key, n: d, status, mine: mineByDay.has(key) })
    }
    return out
  }, [data, cursor, teaching, teacherTz, displayTz, now])

  // ─── One day, as pieces and as offers ──────────────────────────────────────
  const day = useMemo(() => {
    if (!dayKey || !data) return null
    const windows = windowsForLocalDay(dayKey, teaching, teacherTz, displayTz)
    const pieces = localDayPieces(windows, data.busy, data.blocked)
    const ranges = localFreeRanges(windows, data.busy, data.blocked)
      .filter(r => rangeIsBookable(r, undefined, now))
    const close = windows.length ? windows[windows.length - 1].end : null
    return {
      windows, pieces, ranges, close,
      taken: pieces.filter(p => p.kind === 'busy'),
      blocked: pieces.filter(p => p.kind === 'blocked'),
    }
  }, [dayKey, data, teaching, teacherTz, displayTz, now])

  async function book() {
    if (!chosen || !teacher?.id) return
    setWorking(true)
    setBookError('')
    try {
      await createBooking({
        studentId: user.id,
        teacherId: teacher.id,
        scheduledAt: Timestamp.fromDate(chosen.start),
        duration: chosen.duration,
        student: user,
      })
      navigate('/student/dashboard')
    } catch (e) {
      console.error('Booking failed:', e)
      setBookError(
        e?.code === 'slot-taken'
          ? 'Someone took that time while you were choosing. Please pick another.'
          : e?.message || 'Could not book that class. Please try again.',
      )
      setChosen(null)
      await load()
    } finally {
      setWorking(false)
    }
  }

  const closesDay = picking && day?.close && +picking.end === +day.close

  return (
    <StudentLayout>
      <div className="max-w-xl mx-auto">

        {loadError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start justify-between gap-3">
            <span>{loadError}</span>
            <button onClick={load} className="shrink-0 font-semibold underline hover:no-underline">Try again</button>
          </div>
        )}

        {dayKey === null
          ? <Month
              cursor={cursor} setCursor={setCursor} days={days} loading={!data}
              onPick={setDayKey} onCount={setCredits} outOfCredits={outOfCredits}
            />
          : <Day
              dayKey={dayKey} day={day} displayTz={displayTz} view={dayView}
              setView={setDayView} onBack={() => setDayKey(null)}
              onPickRange={setPicking} outOfCredits={outOfCredits}
            />}

        {picking && (
          <TimePickerSheet
            range={picking} tz={displayTz} now={now} closesDay={closesDay}
            onCancel={() => setPicking(null)}
            onPick={({ start, duration }) => { setPicking(null); setChosen({ start, duration }) }}
          />
        )}

        {chosen && (
          <Confirm
            chosen={chosen} displayTz={displayTz} teacherTz={teacherTz}
            working={working} error={bookError}
            onCancel={() => setChosen(null)} onConfirm={book}
          />
        )}
      </div>
    </StudentLayout>
  )
}

// ─── The month ───────────────────────────────────────────────────────────────

const DAY_STYLE = {
  available: 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 cursor-pointer',
  full: 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed',
  blocked: 'bg-orange-50 border border-orange-200 text-orange-700 cursor-not-allowed',
  closed: 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed',
  later: 'bg-white border border-gray-200 text-gray-400 cursor-not-allowed',
  past: 'border border-transparent text-gray-300 cursor-default',
}
const DAY_WORD = {
  available: 'available', full: 'fully booked', blocked: 'unavailable',
  closed: 'no classes', later: 'not open for booking yet', past: 'past',
}

function Month({ cursor, setCursor, days, loading, onPick, onCount, outOfCredits }) {
  const label = new Date(cursor.y, cursor.m, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  function step(by) {
    const d = new Date(cursor.y, cursor.m + by, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-800">Book a class</h1>
      <p className="text-xs text-gray-400 mt-0.5 mb-4">Pick any day that isn't marked.</p>

      <div className="mb-4"><CreditBalance compact onCount={onCount} /></div>

      {outOfCredits && (
        <p className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
          <RiErrorWarningLine size={14} className="shrink-0 mt-px" />
          You'll need credits before you can book a class.
        </p>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => step(-1)} aria-label="Previous month"
            className="p-2 -ml-2 text-gray-400 hover:text-gray-700 transition-colors">
            <RiArrowLeftSLine size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          <button onClick={() => step(1)} aria-label="Next month"
            className="p-2 -mr-2 text-gray-400 hover:text-gray-700 transition-colors">
            <RiArrowRightSLine size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEK.map((w, i) => (
            <span key={i} className="text-center text-[10px] font-bold text-gray-400">{w}</span>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-10">Loading…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {days.map(d => d.blank ? <span key={d.key} /> : (
              <button
                key={d.key}
                onClick={() => d.status === 'available' && onPick(d.key)}
                disabled={d.status !== 'available'}
                aria-label={`${d.n} — ${DAY_WORD[d.status]}`}
                className={`h-12 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${DAY_STYLE[d.status]}`}
              >
                <span className="text-[13px] font-semibold tabular-nums">{d.n}</span>
                {d.mine
                  ? <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  : <span className="w-1.5 h-1.5" />}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-5 pt-4 border-t border-gray-100">
          <Key className="bg-amber-50 border border-amber-200">Available</Key>
          <Key className="bg-white border border-gray-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Your class</Key>
          <Key className="bg-gray-100 border border-gray-200">Fully booked</Key>
          <Key className="bg-orange-50 border border-orange-200">Unavailable</Key>
        </div>
      </div>
    </>
  )
}

function Key({ className, children }) {
  return (
    <span className="flex items-center gap-2 text-[11px] text-gray-500">
      <span className={`w-3.5 h-3.5 rounded shrink-0 ${className}`} />
      {children}
    </span>
  )
}

// ─── One day ─────────────────────────────────────────────────────────────────

function Day({ dayKey, day, displayTz, view, setView, onBack, onPickRange, outOfCredits }) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const title = new Date(y, m - 1, d)
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  if (!day) return null
  const nothing = day.ranges.length === 0

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} aria-label="Back to the month"
          className="p-2 -ml-2 text-amber-600 hover:text-amber-700 transition-colors">
          <RiArrowLeftSLine size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-gray-800 truncate">{title}</h1>
          <p className="text-[11px] text-gray-400">
            {day.windows.length
              ? `Classes run ${fmtTime12(day.windows[0].start, displayTz)} – ${fmtTime12(day.close, displayTz)}`
              : 'No classes this day'}
          </p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
          <Toggle on={view === 'grid'} onClick={() => setView('grid')} label="Grid view"><RiLayoutGridLine size={15} /></Toggle>
          <Toggle on={view === 'list'} onClick={() => setView('list')} label="List view"><RiListUnordered size={15} /></Toggle>
        </div>
      </div>

      {view === 'grid' ? (
        <>
          {(day.taken.length > 0 || day.blocked.length > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Already taken</p>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {[...day.taken, ...day.blocked].map((p, i) => (
                  <span key={i} className="text-[11.5px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1">
                    {fmtRangeLabel(p, displayTz)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Please pick any other time — {countWord(day.taken.length + day.blocked.length)} already booked.
              </p>
            </div>
          )}

          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-2">When you can book</p>
          {nothing
            ? <Empty />
            : (
              <div className="flex flex-col gap-2">
                {day.ranges.map((r, i) => (
                  <RangeRow key={i} range={r} tz={displayTz} closesDay={+r.end === +day.close}
                    disabled={outOfCredits} onClick={() => onPickRange(r)} />
                ))}
              </div>
            )}
          <p className="text-[11px] text-gray-400 leading-relaxed mt-3">
            Tap a stretch and set the exact start on the clock — 3:30, 4:15, whatever suits you.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500 leading-relaxed bg-white border border-gray-100 rounded-xl px-3 py-2.5 mb-3">
            The whole day, in order. Tap any free stretch to take a time inside it.
          </p>
          {nothing ? <Empty /> : (
            <div className="flex flex-col gap-1.5">
              {day.pieces.map((p, i) => p.kind === 'free'
                ? (p.minutes >= 30
                    ? <RangeRow key={i} range={p} tz={displayTz} closesDay={+p.end === +day.close}
                        disabled={outOfCredits} onClick={() => onPickRange(p)} />
                    : null)
                : (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-100 border border-gray-200">
                    <span className="w-0.5 self-stretch rounded-full bg-gray-300 shrink-0" />
                    <RiLock2Line size={13} className="text-gray-400 shrink-0" />
                    <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-gray-500">{fmtRangeLabel(p, displayTz)}</span>
                    <span className="text-[10.5px] font-semibold text-gray-400 shrink-0">
                      {p.kind === 'blocked' ? 'Unavailable' : 'Booked'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function Toggle({ on, onClick, label, children }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={on}
      className={`w-9 h-8 rounded-md flex items-center justify-center transition-colors ${
        on ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
      }`}>
      {children}
    </button>
  )
}

function RangeRow({ range, tz, closesDay, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      aria-label={`${fmtRangeLabel(range, tz)}, available — set an exact time`}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold text-amber-900">{fmtRangeLabel(range, tz)}</span>
        <span className="block text-[10.5px] text-amber-700 mt-px">{describeRange(range, { closesDay })}</span>
      </span>
      <RiArrowRightSLine size={18} className="text-amber-600 shrink-0" />
    </button>
  )
}

function Empty() {
  return (
    <p className="bg-white border border-gray-100 rounded-xl px-4 py-6 text-center text-sm text-gray-400">
      Nothing left on this day. Try another.
    </p>
  )
}

function countWord(n) {
  if (n === 1) return 'that slot is'
  if (n === 2) return 'those two slots are'
  if (n === 3) return 'those three slots are'
  return `those ${n} slots are`
}

// ─── Confirming ──────────────────────────────────────────────────────────────

function Confirm({ chosen, displayTz, teacherTz, working, error, onCancel, onConfirm }) {
  const ends = new Date(chosen.start.getTime() + chosen.duration * 60000)
  // Guruji's clock, whenever it disagrees with the student's — and the DATE
  // too when it is a different day for him, which it often is for the students
  // abroad this long teaching day exists for.
  const shifted = fmtTime12(chosen.start, displayTz) !== fmtTime12(chosen.start, teacherTz)
  const otherDay = !sameCalendarDay(chosen.start, displayTz, teacherTz)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Confirm your class</h2>
            <p className="text-xs text-gray-500 mt-0.5">This books the slot straight away.</p>
          </div>
          <button onClick={onCancel} aria-label="Close"
            className="shrink-0 -mr-2 -mt-1 p-2 text-gray-400 hover:text-gray-700 transition-colors">
            <RiCloseLine size={20} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <RiCalendarLine size={17} className="text-amber-600" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-800">{fmtLongDate(chosen.start, displayTz)}</span>
                <span className="block text-xs text-gray-500">
                  {fmtTime12(chosen.start, displayTz)} – {fmtTime12(ends, displayTz)} · {chosen.duration} minutes
                </span>
              </span>
            </div>
          </div>

          {shifted && (
            <p className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 mb-2 text-[11.5px] leading-relaxed text-amber-800 flex items-start gap-2">
              <RiTimeLine size={14} className="shrink-0 mt-px" />
              <span>
                For Guruji this is <strong className="font-bold">{fmtTime12(chosen.start, teacherTz)}</strong>
                {otherDay && <>, <strong className="font-bold">{fmtDayInTz(chosen.start, teacherTz)}</strong></>}.
              </span>
            </p>
          )}

          {/* On its own line. The deadline is what the studio ASKS for; a late
              cancellation still returns the credit, because keeping it would
              mean charging for a lesson nobody taught. Saying the stricter rule
              and behaving by the kinder one leaves nobody worse off than they
              were told. */}
          <p className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 mb-4 text-[11.5px] leading-relaxed text-gray-500">
            Need to cancel? Please do it at least <strong className="font-bold text-gray-800">24 hours ahead</strong> so your credit goes back to your account.
          </p>

          {error && (
            <p className="mb-3 text-xs text-red-600 flex items-start gap-1.5">
              <RiErrorWarningLine size={14} className="shrink-0 mt-px" />{error}
            </p>
          )}

          <button onClick={onConfirm} disabled={working}
            className="w-full h-12 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
            {working ? 'Booking…' : <><RiCheckLine size={16} /> Confirm booking</>}
          </button>
          <button onClick={onCancel} className="w-full h-11 text-[13px] font-semibold text-gray-500">
            Pick a different time
          </button>
        </div>
      </div>
    </div>
  )
}
