import { useState } from 'react'
import { RiArrowDownSLine, RiQuestionLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/admin/AdminLayout'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import StudentLayout from '../../components/student/StudentLayout'
import { usesCredits } from '../../utils/credits'

// ─── Help ────────────────────────────────────────────────────────────────────
// One set of answers for everyone. Staff get asked these questions by students
// and need to answer them the same way, so a separate staff version would only
// drift from this one.
//
// Written in the second person and in plain words. Someone reading this is
// confused already; "your credit batch has lapsed" would not help them.
function sections(student, isStaff) {
  // Staff have no billingMode of their own, so they would otherwise be shown
  // no credits section at all — the very part students ask them about.
  const onCredits = isStaff || usesCredits(student)

  // The page deliberately quotes no numbers — no cap, no window in weeks, no
  // list of sizes. They differ between students, and a student reading that
  // another student may buy twelve when they may buy three learns nothing
  // useful and asks a question Guruji then has to answer. The Buy screen shows
  // each person their own options and their own date, which is where that
  // belongs.
  return [
    {
      title: 'Booking a class',
      items: [
        {
          q: 'How do I book a class?',
          a: `Open "Book a Class", tap a date, then tap a free slot. Tap it a second time to confirm. You'll see the time in your own timezone, and Guruji's too if you're in a different one.`,
        },
        {
          q: 'Why can’t I pick some times?',
          a: 'A slot in red is already taken, or Guruji has marked himself unavailable. Only free slots can be booked — two classes can never share a time.',
        },
        {
          q: 'Can I change or cancel a class?',
          a: 'Yes. Open the class on your dashboard. "Reschedule" asks Guruji to move it to a time you pick; "Cancel" calls it off. Either way he is told straight away.',
        },
        {
          q: 'What happens if nobody turns up?',
          a: 'Guruji can mark the class as missed. If it was paid for with a credit, he decides whether to give it back — speak to him if you think it should come back.',
        },
      ],
    },
    ...(onCredits ? [{
      title: 'Credits',
      items: [
        {
          q: 'What is a credit?',
          a: 'One credit is one class. You buy credits in advance, and booking a class uses one. It saves settling up after every lesson.',
        },
        {
          q: 'How do I buy classes?',
          a: 'Open "Fees" and tap "Buy credits". Choose how many classes you want — one credit is one class — and pay by any of the methods offered. The classes appear on your dashboard a moment later. If anything goes wrong, tell Guruji.',
        },
        {
          q: 'When do they expire?',
          a: 'Each purchase runs for a set period, and the exact date is shown before you pay and again with your balance. If you still have classes left when you buy more, the new ones do not start counting until the old ones run out — so topping up adds time rather than overwriting it.',
        },
        {
          q: 'What if I can’t use them in time?',
          a: 'Tell Guruji as early as you can, rather than once the date has gone. Illness, travel and exams are all ordinary and he would far rather hear about it in advance than find classes sitting unused.',
        },
        {
          q: 'I cancelled a class. Do I get the credit back?',
          a: 'If Guruji cancels, or he is away, the credit comes straight back. If you cancel your own class, it is held while he decides — that way a genuine reason is never treated the same as a change of mind.',
        },
      ],
    }] : []),
    {
      title: 'Paying',
      items: [
        {
          q: 'I paid but nothing happened.',
          a: 'Give it a few seconds — the app waits for the bank to confirm rather than taking its own word for it. If it still has not appeared, tell Guruji. The payment is recorded either way, so nothing is lost.',
        },
      ],
    },
    {
      title: 'Your account',
      items: [
        {
          q: 'How do I change my name, photo or number?',
          a: 'Settings → Profile → Edit. Your User ID cannot be changed, because it is how you sign in. Changing your number tells Guruji, so he is not left ringing the old one.',
        },
        {
          q: 'I have moved. How do I change my timezone?',
          a: 'Settings → Timezone. Every class time then shows in your new one, and Guruji is told — he schedules around it, so he needs to know before your next lesson rather than after it.',
        },
        {
          q: 'I forgot my password.',
          a: 'Ask Guruji to reset it. There is no self-service reset — your login is a User ID, not an email address.',
        },
        {
          q: 'Can I use this on my phone?',
          a: 'Yes. Open it in your browser and use "Add to Home screen" — it then behaves like an app, including notifications. On an iPhone you must add it to the home screen for notifications to work at all.',
        },
        {
          q: 'How do I change how it looks?',
          a: 'Settings → Appearance. Light, dark, or match your phone. It only changes this device.',
        },
      ],
    },
    {
      title: 'Recordings and reminders',
      items: [
        {
          q: 'Where are my class recordings?',
          a: 'Under "Recordings" once Guruji has added one. They include the link and the passcode together, with a button to copy them.',
        },
        {
          q: 'Can I get a reminder before class?',
          a: 'Yes — Settings → Notifications. Choose how long before, from a few minutes to a day.',
        },
      ],
    },
  ]
}

export default function Help() {
  const { user, role } = useAuth()
  const Layout = role === 'admin' ? AdminLayout : role === 'teacher' ? TeacherLayout : StudentLayout
  const [open, setOpen] = useState(null)
  const isStaff = role === 'admin' || role === 'teacher'
  const groups = sections(user, isStaff)

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <RiQuestionLine size={20} className="text-gray-400" />
          <h1 className="text-xl font-semibold text-gray-800">Help</h1>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          {isStaff
            ? 'The same answers your students see — so everyone is told the same thing.'
            : 'Short answers to the things people ask most.'}
        </p>

        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {group.title}
              </h2>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {group.items.map((item, i) => {
                  const id = `${group.title}-${i}`
                  const isOpen = open === id
                  return (
                    <div key={id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                      <button
                        onClick={() => setOpen(isOpen ? null : id)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-800">{item.q}</span>
                        <RiArrowDownSLine
                          size={18}
                          className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <p className="px-4 pb-4 -mt-1 text-sm text-gray-500 leading-relaxed">
                          {item.a}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">
          Still stuck? Speak to Guruji — he can see everything this page describes.
        </p>
      </div>
    </Layout>
  )
}
