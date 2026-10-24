import { useState } from 'react'
import { RiArrowDownSLine, RiQuestionLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/admin/AdminLayout'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import StudentLayout from '../../components/student/StudentLayout'
import { usesCredits, validityRangeLabel, creditCap, classOptions } from '../../utils/credits'

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

  // A student is told their own window and their own limit; staff are told
  // both, since they answer for everybody.
  const validity = isStaff
    ? '4 weeks for students in India; abroad it depends on how many are bought — 2 weeks for one class, up to 15 for twelve'
    : validityRangeLabel(student)
  const cap = isStaff
    ? '3 for students in India and up to 12 for students abroad'
    : String(creditCap(student))
  const choices = isStaff
    ? '1, 2 or 3 in India; 1, 3, 4 or 12 abroad'
    : classOptions(student).join(', ')

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
          a: `Open "Fees" and tap "Buy credits". You will be asked how many classes you want (${choices}) and what you are paying — type the amount you agreed with Guruji. Pay by card, UPI or netbanking, and the classes appear on your dashboard a moment later. You can also pay Guruji or the office directly and they will add them for you.`,
        },
        {
          q: 'What amount should I enter?',
          a: 'Whatever you agreed with Guruji for that many classes. The app does not set the price — fees differ from student to student — so it records what you type. If you are not sure of the amount, ask the office before paying rather than guessing.',
        },
        {
          q: `How many can I hold at once?`,
          a: `${cap}. It is a limit on how many are sitting unused, not a monthly allowance — the moment you use one, room opens up and you can buy again. Finish them all in a fortnight and you can buy more that same day.`,
        },
        {
          q: 'When do they expire?',
          a: `They last ${validity} from the day they are added, and then run to the end of that week — always a Sunday, so you are never counting to an odd weekday. The exact date is shown before you pay and again with your balance. If something comes up, Guruji or the office can extend it.`,
        },
        {
          q: 'What if my credits expired and I didn’t use them?',
          a: 'Speak to Guruji or the office. They can bring expired credits back — it is a conversation, not a rule the app enforces against you.',
        },
        {
          q: 'I cancelled a class. Do I get the credit back?',
          a: 'If Guruji cancels, or he is away, the credit comes straight back. If you cancel your own class, it is held while he decides — that way a genuine reason is never treated the same as a change of mind.',
        },
        {
          q: 'Why does it say I need credits before booking?',
          a: 'You have none left. Buy some from the Fees page, or ask the office to add them.',
        },
      ],
    }] : []),
    {
      title: 'Paying',
      items: [
        {
          q: 'What does a class cost?',
          a: 'Whatever was agreed with Guruji — your fee is on your profile and the app charges exactly that. If something looks wrong, ask the office rather than paying it.',
        },
        {
          q: 'Is my card safe?',
          a: 'The studio never sees your card details. Payment is handled by Razorpay, who take the card directly; the app is only told whether it worked.',
        },
        {
          q: 'I paid but nothing happened.',
          a: 'Give it a few seconds — the app waits for the bank to confirm rather than taking its own word for it. If it still has not appeared, tell the office. The payment is recorded either way, so nothing is lost.',
        },
      ],
    },
    {
      title: 'Your account',
      items: [
        {
          q: 'How do I change my name, photo or number?',
          a: 'Settings → Profile → Edit. Your User ID cannot be changed, because it is how you sign in.',
        },
        {
          q: 'I forgot my password.',
          a: 'Ask Guruji or the office to reset it. There is no self-service reset — your login is a User ID, not an email address.',
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
          Still stuck? Speak to Guruji or the office — they can see everything this page describes.
        </p>
      </div>
    </Layout>
  )
}
