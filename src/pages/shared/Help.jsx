import { useState } from 'react'
import { RiArrowDownSLine, RiQuestionLine, RiWhatsappLine } from 'react-icons/ri'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/admin/AdminLayout'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import StudentLayout from '../../components/student/StudentLayout'
import { usesCredits, paysByTransfer } from '../../utils/credits'
import { useContact } from '../../firebase/contact'

// ─── Help ────────────────────────────────────────────────────────────────────
// A handful of answers, kept short on purpose: what a credit is, how to book,
// how to buy, and what happens when a class is cancelled, moved or missed.
// Anything else goes to the enquiries contact at the top of the page.
//
// Students do not all pay the same way — some pay online, some by bank
// transfer — and the buying answer differs to match. Which one a student sees
// comes from their profile, and the wording never says WHY: nobody is told
// they are being shown this because of where they live. Each student simply
// sees the one way that applies to them.
//
// Staff see every answer, with a small note on the two that differ, so they
// know what each student has been told.

function sections({ onCredits, byTransfer, isStaff, contactName }) {
  const ask = contactName ? `get in touch with ${contactName}` : 'get in touch with the studio'

  const buyOnline = {
    q: 'How do I buy credits?',
    tag: 'Students who pay online',
    a: 'Tap "Buy credits" on your credits card. Choose how many classes you would like, enter the amount, and pay by card, UPI or netbanking. Your credits appear on your dashboard a moment later.',
  }
  const buyTransfer = {
    q: 'How do I buy credits?',
    tag: 'Students who pay by bank transfer',
    a: 'Tap "Request credits" on your credits card — the account details to pay into are shown there. Send the payment from your bank, then enter the amount and currency you sent and tap "Request credits". Your credits appear once the payment has been received, which for a bank transfer can take a few days.',
  }
  const buying = isStaff ? [buyOnline, buyTransfer] : [byTransfer ? buyTransfer : buyOnline]

  return [
    ...(onCredits ? [{
      title: 'Credits',
      items: [
        {
          q: 'What is a credit?',
          a: 'One credit is one class. You buy credits in advance, and booking a class uses one. Credits are valid for a set period — the date they run until is shown with your balance and before you buy.',
        },
        ...buying,
      ],
    }] : []),
    {
      title: 'Booking',
      items: [
        {
          q: 'How do I book a class?',
          a: 'Open "Book a Class" and tap any day that is not marked. Pick one of the free times, set your start time and how long the class should be, then confirm. Times are shown in your own timezone, and you can book up to a week ahead.',
        },
      ],
    },
    {
      title: 'Changes',
      items: [
        {
          q: 'What if I cancel a class?',
          a: onCredits
            ? 'Open the class on your dashboard and tap "Cancel". Please cancel at least 24 hours before the class, so your credit goes back to your account.'
            : 'Open the class on your dashboard and tap "Cancel". Please cancel at least 24 hours before the class where you can.',
        },
        {
          q: 'What if I need to reschedule?',
          a: onCredits
            ? 'Open the class on your dashboard, tap "Reschedule" and pick a new date and time. The studio confirms the new time. If it cannot be arranged, the class is called off and your credit goes back to your account.'
            : 'Open the class on your dashboard, tap "Reschedule" and pick a new date and time. The studio confirms the new time, and you are told either way.',
        },
        {
          q: 'What if I miss a class?',
          a: onCredits
            ? `A class missed without cancelling normally uses its credit, so please cancel if you know you cannot make it. If something unexpected stopped you, ${ask}.`
            : `Please cancel if you know you cannot make it. If something unexpected stopped you, ${ask}.`,
        },
      ],
    },
    {
      title: 'Your account',
      items: [
        {
          q: 'How do I change my name, photo or phone number?',
          a: 'Go to Settings → Profile and tap "Edit". Your User ID cannot be changed, because it is how you sign in. If you change your phone number, the studio is told automatically, so nobody is left calling the old one.',
        },
        {
          q: 'How do I change my timezone?',
          a: 'Go to Settings → Your Timezone, choose where you are, and save. Do this whenever you move, or travel somewhere for a while. The app uses the timezone saved here, not your phone’s clock, so if this is out of date your class times will be too. The studio is told when you change it.',
        },
        {
          q: 'Why do I sometimes see two times?',
          // Kept as an example, not a rule. Two cities are named only to make
          // the arithmetic visible; the answer reads the same to everyone and
          // says plainly that a student in Guruji's own timezone simply sees
          // one time.
          a: 'Everything in the app is shown in your own timezone, so you never have to work anything out yourself. Guruji sees the same class in his. For example, if you are in Dubai and book a class at 3:30 pm, you see 3:30 pm, and Guruji sees 5:00 pm in India. It is the same moment, shown on two clocks. Whenever his time is different from yours, the app shows it next to yours, and the booking confirmation shows both, so you both know exactly when to be there. Sometimes the date is different as well: a Tuesday evening in New York, for instance, is already Wednesday morning in India. When that happens the app says so, and Guruji sees a note telling him the date is different for you. If you are in the same timezone as Guruji, you will only ever see one time.',
        },
        {
          q: 'I forgot my password.',
          a: `There is no reset email, because you sign in with a User ID rather than an email address. Please ${ask}, and a new password can be set for you.`,
        },
      ],
    },
    {
      title: 'Recordings and reminders',
      items: [
        {
          q: 'Where are my class recordings?',
          a: 'Open "Recordings". A recording appears there once it has been added after your class, with the link and passcode together and a button to copy them.',
        },
        {
          q: 'Can I get a reminder before class?',
          a: 'Yes. Go to Settings → Notifications, turn notifications on, and choose how long before each class you would like to be reminded — anything from a few minutes to a day.',
        },
        {
          q: 'I use an iPhone. Why am I not getting reminders?',
          a: 'On an iPhone, reminders can only reach you once the app is on your home screen. Open the app in Safari, tap the Share button, then "Add to Home Screen". From then on, open the app from that new icon, and turn notifications on in Settings → Notifications from inside it.',
        },
      ],
    },
  ]
}

// "+91 70038 86380" → "917003886380", the form wa.me expects.
function waNumber(phone) {
  return String(phone || '').replace(/\D/g, '')
}

export default function Help() {
  const { user, role } = useAuth()
  const Layout = role === 'admin' ? AdminLayout : role === 'teacher' ? TeacherLayout : StudentLayout
  const [open, setOpen] = useState(null)
  const contact = useContact()

  const isStaff = role === 'admin' || role === 'teacher'
  const groups = sections({
    // Staff have no billingMode of their own, so they would otherwise be
    // shown no credits section at all — the part students ask them about.
    onCredits: isStaff || usesCredits(user),
    byTransfer: paysByTransfer(user),
    isStaff,
    contactName: contact?.name || '',
  })

  const firstName = (user?.name || '').split(' ')[0]
  const greeting = contact?.name
    ? `Hi ${contact.name}${firstName && !isStaff ? `, this is ${firstName}` : ''}. I have a question about my classes.`
    : 'Hi, I have a question about my classes.'
  const waLink = contact?.phone
    ? `https://wa.me/${waNumber(contact.phone)}?text=${encodeURIComponent(greeting)}`
    : null

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <RiQuestionLine size={20} className="text-gray-400" />
          <h1 className="text-xl font-semibold text-gray-800">Help</h1>
        </div>
        <p className="text-sm text-gray-400 mb-5">
          {isStaff
            ? 'What your students see here. The two buying answers differ by how each student pays.'
            : 'Short answers to the things people ask most.'}
        </p>

        {/* The first thing on the page: a person to ask, one tap away. */}
        {waLink && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">Have a question?</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {contact.name ? `${contact.name} · ` : ''}{contact.phone}
              </p>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 bg-[#1FA855] hover:bg-[#1A9049] text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <RiWhatsappLine size={18} /> WhatsApp
            </a>
          </div>
        )}

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
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-800">{item.q}</span>
                          {isStaff && item.tag && (
                            <span className="block text-[11px] text-amber-700 mt-0.5">{item.tag}</span>
                          )}
                        </span>
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
          {contact?.name
            ? `For any other questions, ${contact.name} is happy to help.`
            : 'For any other questions, get in touch with the studio.'}
        </p>
      </div>
    </Layout>
  )
}
