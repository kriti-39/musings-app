# -*- coding: utf-8 -*-
"""Builds the Deva's Classes user manual PDF."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, ListFlowable, ListItem, KeepTogether
)

# ── Brand palette ────────────────────────────────────────────────────────────
NAVY   = colors.HexColor("#0d1117")
NAVY2  = colors.HexColor("#161b22")
GOLD   = colors.HexColor("#c8920a")
GOLD_L = colors.HexColor("#f5c518")
INK    = colors.HexColor("#1f2933")
GRAY   = colors.HexColor("#5b6573")
LIGHT  = colors.HexColor("#eef1f5")
GREEN  = colors.HexColor("#1a7f4b")
RED    = colors.HexColor("#c0392b")

OUT = r"F:\JuniorProjects\Deva's Music Classes\Devas_Classes_User_Manual.pdf"

# ── Use system Arial (full Unicode coverage → em-dashes, curly quotes, etc.) ──
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os as _os
_fonts = r"C:\Windows\Fonts"
try:
    pdfmetrics.registerFont(TTFont("AppFont", _os.path.join(_fonts, "arial.ttf")))
    pdfmetrics.registerFont(TTFont("AppFont-Bold", _os.path.join(_fonts, "arialbd.ttf")))
    pdfmetrics.registerFont(TTFont("AppFont-Italic", _os.path.join(_fonts, "ariali.ttf")))
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    registerFontFamily("AppFont", normal="AppFont", bold="AppFont-Bold", italic="AppFont-Italic", boldItalic="AppFont-Bold")
except Exception as e:
    print("Arial not found, falling back to Helvetica:", e)
    pdfmetrics.registerFont(TTFont) if False else None

styles = getSampleStyleSheet()
def S(name, **kw):
    styles.add(ParagraphStyle(name, **kw))

S("Cover",      fontName="AppFont-Bold", fontSize=30, textColor=GOLD_L, alignment=TA_CENTER, leading=34)
S("CoverSub",   fontName="AppFont",      fontSize=13, textColor=colors.whitesmoke, alignment=TA_CENTER, leading=18)
S("CoverSmall", fontName="AppFont",      fontSize=10, textColor=colors.HexColor("#9aa4b2"), alignment=TA_CENTER, leading=14)
S("H1", fontName="AppFont-Bold", fontSize=16, textColor=GOLD, spaceBefore=16, spaceAfter=4, leading=20)
S("H2", fontName="AppFont-Bold", fontSize=12.5, textColor=NAVY, spaceBefore=11, spaceAfter=3, leading=16)
S("Body", fontName="AppFont", fontSize=10.3, textColor=INK, leading=15, spaceAfter=5, alignment=TA_LEFT)
S("MBullet", fontName="AppFont", fontSize=10.3, textColor=INK, leading=15)
S("Note", fontName="AppFont-Italic", fontSize=9.6, textColor=GRAY, leading=14, spaceAfter=5)
S("TblHead", fontName="AppFont-Bold", fontSize=9.8, textColor=colors.white, leading=12)
S("TblCell", fontName="AppFont", fontSize=9.6, textColor=INK, leading=12.5)
S("TblCellB", fontName="AppFont-Bold", fontSize=9.6, textColor=NAVY, leading=12.5)
S("TOC", fontName="AppFont", fontSize=11, textColor=INK, leading=20)

def H1(t): return Paragraph(t, styles["H1"])
def H2(t): return Paragraph(t, styles["H2"])
def P(t):  return Paragraph(t, styles["Body"])
def Note(t): return Paragraph('<font color="#c8920a"><b>Note&nbsp;&mdash;</b></font> ' + t, styles["Note"])
def rule(): return HRFlowable(width="100%", thickness=1.1, color=GOLD, spaceBefore=2, spaceAfter=8)
def thin(): return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d6dbe2"), spaceBefore=6, spaceAfter=6)

def bullets(items):
    li = [ListItem(Paragraph(t, styles["MBullet"]), leftIndent=6, value="•") for t in items]
    return ListFlowable(li, bulletType="bullet", bulletColor=GOLD, bulletFontSize=8,
                        leftIndent=12, spaceBefore=2, spaceAfter=6)

def steps(items):
    li = [ListItem(Paragraph(t, styles["MBullet"]), leftIndent=6) for t in items]
    return ListFlowable(li, bulletType="1", bulletColor=GOLD, bulletFontName="AppFont-Bold",
                        leftIndent=14, spaceBefore=2, spaceAfter=6)

def table(headers, rows, widths):
    data = [[Paragraph(h, styles["TblHead"]) for h in headers]]
    for r in rows:
        data.append([Paragraph(c, styles["TblCell"]) for c in r])
    t = Table(data, colWidths=widths, hAlign="LEFT")
    st = [
        ("BACKGROUND", (0,0), (-1,0), NAVY),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#cbd2da")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 7),
        ("RIGHTPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]
    t.setStyle(TableStyle(st))
    return t

def callout(title, lines, color=GOLD):
    inner = [Paragraph(f'<b>{title}</b>', ParagraphStyle("ct", fontName="AppFont-Bold", fontSize=10, textColor=color, leading=14))]
    for ln in lines:
        inner.append(Paragraph(ln, ParagraphStyle("cb", fontName="AppFont", fontSize=9.6, textColor=INK, leading=13.5)))
    t = Table([[inner]], colWidths=[165*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fbf6e9") if color==GOLD else colors.HexColor("#eef6f0")),
        ("BOX", (0,0), (-1,-1), 1, color),
        ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    return t

# ── Page furniture ───────────────────────────────────────────────────────────
def cover_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    # gold accent bands
    canvas.setFillColor(GOLD)
    canvas.rect(0, A4[1]-12*mm, A4[0], 4*mm, fill=1, stroke=0)
    canvas.rect(0, 10*mm, A4[0], 4*mm, fill=1, stroke=0)
    canvas.restoreState()

def later_bg(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d6dbe2"))
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 14*mm, A4[0]-20*mm, 14*mm)
    canvas.setFont("AppFont", 8)
    canvas.setFillColor(GRAY)
    canvas.drawString(20*mm, 9*mm, "Deva's Classes — User Manual")
    canvas.drawRightString(A4[0]-20*mm, 9*mm, "Page %d" % (doc.page - 1))
    canvas.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[Frame(0, 0, A4[0], A4[1], leftPadding=30*mm, rightPadding=30*mm,
                                            topPadding=70*mm, bottomPadding=40*mm)], onPage=cover_bg),
    PageTemplate(id="body", frames=[frame], onPage=later_bg),
])

from reportlab.platypus import NextPageTemplate
story = []

# ── COVER ────────────────────────────────────────────────────────────────────
story += [
    Paragraph("Deva's Classes", styles["Cover"]),
    Spacer(1, 6*mm),
    Paragraph("Music Class Management — User Manual", styles["CoverSub"]),
    Spacer(1, 3*mm),
    Paragraph("Online classical-music studio of Debapriya Adhikary", styles["CoverSmall"]),
    Spacer(1, 30*mm),
    Paragraph("For Students, Teachers &amp; Admins", styles["CoverSub"]),
    Spacer(1, 2*mm),
    Paragraph("Version 1.0", styles["CoverSmall"]),
    NextPageTemplate("body"),
    PageBreak(),
]

# ── CONTENTS ─────────────────────────────────────────────────────────────────
story += [H1("Contents"), rule()]
toc = [
    "1.  Welcome &amp; the three roles",
    "2.  Getting started (login, install, dark mode)",
    "3.  Student guide",
    "4.  Teacher &amp; Admin guide",
    "5.  How booking works (at a glance)",
    "6.  How payments work (at a glance)",
    "7.  Tips, FAQ &amp; troubleshooting",
]
for t in toc:
    story.append(Paragraph(t, styles["TOC"]))
story.append(PageBreak())

# ── 1. WELCOME ───────────────────────────────────────────────────────────────
story += [H1("1.&nbsp; Welcome &amp; the three roles"), rule()]
story.append(P("<b>Deva's Classes</b> is the online home for Debapriya Adhikary’s music studio. "
    "It lets students book and manage their classes and pay fees, while the teacher and admins run the "
    "schedule, students and payments — all in one place, on phone or computer."))
story.append(P("There are three kinds of accounts:"))
story.append(table(
    ["Role", "What they can do"],
    [
        ["Student", "Book, reschedule and cancel their own classes; submit fee payments; see their history."],
        ["Teacher", "Everything: run the schedule, manage students, confirm bookings &amp; payments, and create Admins. This is the main studio account."],
        ["Admin", "All the same management features as the Teacher (schedule, students, fees). Admins are created by the Teacher."],
    ],
    [28*mm, 137*mm]))
story.append(Note("Students never sign up by themselves — the Teacher or an Admin creates each student’s login."))

# ── 2. GETTING STARTED ───────────────────────────────────────────────────────
story += [H1("2.&nbsp; Getting started"), rule()]
story.append(H2("Opening the app"))
story.append(P("Open the studio link in any browser (Chrome recommended) on your phone or computer. "
    "You can <b>install it like an app</b>: in Chrome, tap the browser menu (the three-dots icon) and choose "
    "<b>“Add to Home screen” / “Install app”</b>. It then opens full-screen like a normal app."))
story.append(H2("Logging in"))
story.append(steps([
    "Enter the <b>email</b> and <b>password</b> you were given.",
    "Tap <b>Log in</b>. You’ll land on your dashboard.",
]))
story.append(Note("Forgot your password? There is no in-app reset — contact the Teacher/Admin and they will reset it for you."))
story.append(H2("Light &amp; dark mode"))
story.append(P("Use the theme toggle to switch between a bright look and the dark blue night look. Your choice is remembered."))
story.append(H2("Automatic updates"))
story.append(P("The app updates itself — when a new version is released it refreshes on its own the next time you open it. "
    "You don’t need to clear anything."))

story.append(PageBreak())

# ── 3. STUDENT GUIDE ─────────────────────────────────────────────────────────
story += [H1("3.&nbsp; Student guide"), rule()]

story.append(H2("Your classes (the dashboard)"))
story.append(P("“My Classes” shows your lessons under three tabs:"))
story.append(bullets([
    "<b>Upcoming</b> — confirmed classes plus any requests awaiting the teacher.",
    "<b>Completed</b> — finished classes.",
    "<b>Cancelled</b> — cancelled or declined classes.",
]))
story.append(Note("All times are shown in <b>your own timezone</b>. If you study from abroad, you can also see the teacher’s time while booking."))

story.append(H2("Booking a class"))
story.append(steps([
    "Tap <b>Book a Class</b>.",
    "In <b>Month</b> view, tap the date you want — it opens that day.",
    "In <b>Day</b> view, tap a free time slot once to highlight it, then tap again (or <b>Book this slot</b>) to open the form. "
        "You can also tap the <b>Book Class</b> button to pick the date and time by hand.",
    "Choose the <b>duration</b> (30 / 45 / 60 / 90 min) and add a short <b>note</b> for the teacher if you like.",
    "Check the time, then tap <b>Book Class</b>.",
]))
story.append(P("The colour legend on the calendar:"))
story.append(table(
    ["Tag", "Meaning"],
    [["Upcoming", "Your own booked class."],
     ["Busy", "That time is already taken — you can still request it."],
     ["Done", "A completed class."]],
    [30*mm, 135*mm]))
story.append(callout("What happens after you book", [
    "• If the slot is <b>free</b> → your class is <b>booked &amp; confirmed</b> instantly.",
    "• If it <b>overlaps</b> another class → a <b>request is sent</b> and the teacher confirms it. You’ll get a notification.",
]))
story.append(Note("Studying from a different country? Use the <b>My time / Teacher’s time</b> toggle — the booking screen shows both times so you pick a slot that suits you both."))

story.append(H2("Rescheduling a class"))
story.append(P("On an upcoming class, tap <b>Reschedule</b>, pick a new date &amp; time, and send the request. "
    "The class shows <b>“Awaiting confirmation”</b> until the teacher approves the new time."))

story.append(H2("Cancelling a class"))
story.append(P("Tap <b>Cancel</b> and confirm. The class is cancelled <b>immediately</b> and the teacher is automatically notified. "
    "(For a request that isn’t confirmed yet, this simply withdraws it.)"))

story.append(H2("Marking a class done"))
story.append(P("After a lesson you can tap <b>Mark Done</b> to move it to your Completed list."))

story.append(H2("Paying fees"))
story.append(P("Open <b>Fees</b> to see each month’s status — <b>Paid</b>, <b>Pending confirmation</b>, or <b>Unpaid</b>."))
story.append(steps([
    "Tap <b>Submit Payment</b>.",
    "Enter the <b>amount</b> and choose the <b>method</b>: UPI, Bank transfer, or Cash.",
    "Select the <b>month(s)</b> you’re paying for (you can select several at once).",
    "For UPI / bank transfer, <b>upload a screenshot</b> of the receipt. (Cash needs no upload.)",
    "Tap <b>Submit</b>. The payment shows <b>Pending</b> until the teacher/admin confirms it.",
]))
story.append(Note("If a payment is declined, you’ll be asked to submit it again."))

story.append(H2("Notifications"))
story.append(P("The bell icon shows updates — class confirmations, reschedule results and payment confirmations. "
    "Tap one to view it; you can clear them when done."))

story.append(PageBreak())

# ── 4. TEACHER / ADMIN GUIDE ─────────────────────────────────────────────────
story += [H1("4.&nbsp; Teacher &amp; Admin guide"), rule()]
story.append(P("Teacher and Admin screens are the same. The only difference: the <b>Teacher</b> can create <b>Admins</b>."))

story.append(H2("Dashboard"))
story.append(P("Four cards at the top — tap any to drill in:"))
story.append(bullets([
    "<b>Total Students</b> → opens the student list.",
    "<b>Today’s Classes</b> → opens the schedule.",
    "<b>Pending Requests</b> → bookings waiting for you.",
    "<b>This Month</b> → opens a <b>list of the month’s classes</b> (grouped by day).",
]))
story.append(P("Below the cards: <b>Today’s Classes</b> and a <b>Needs Confirmation</b> section where you "
    "<b>Confirm</b> or <b>Reject</b> student booking/reschedule requests in one tap."))

story.append(H2("Schedule"))
story.append(P("Switch between <b>Month</b>, <b>Week</b> and <b>Day</b> views. <b>Today</b> jumps back to now."))
story.append(steps([
    "<b>Create a class</b>: choose the student, date &amp; time, duration, optional recurring schedule, and notes.",
    "<b>Two-click booking</b>: tap a slot to highlight, tap again to open the form.",
    "<b>Open any class</b> to see its details and act on it.",
]))
story.append(P("From a class’s detail screen you can <b>Mark as Done</b>, <b>Reschedule</b>, add/edit <b>Lesson Notes</b>, "
    "<b>Cancel</b>, or <b>Delete</b>. Each important action asks <b>“Are you sure?”</b> first to avoid mistakes. "
    "Pending requests show <b>Confirm</b> / <b>Reject</b> buttons."))
story.append(Note("When you reschedule, cancel or book, the student is <b>notified automatically</b> — no approval needed from them."))

story.append(H2("Students (Users)"))
story.append(bullets([
    "See <b>Active</b>, <b>Deactivated</b> and <b>Admins</b>. Search and sort the list.",
    "<b>Tap anywhere on a student’s row</b> to open their profile.",
    "<b>Add Student</b> creates their login (share the email &amp; password with them).",
    "<b>Deactivate / Reactivate</b> to pause or restore access (reversible).",
    "<b>Delete</b> permanently removes a student and their data — it asks you to confirm first.",
    "<b>Teacher only:</b> <b>Add Admin</b> to give someone full management access.",
]))

story.append(H2("Student profile"))
story.append(P("Shows the student’s details and quick stats (upcoming, completed, payments). From here you can "
    "<b>record a payment</b> for them and <b>confirm or decline</b> payments they’ve submitted."))

story.append(H2("Fees"))
story.append(P("Pick a month to see every student’s status with a <b>Paid / Pending / Unpaid</b> summary."))
story.append(bullets([
    "<b>Confirm</b> or <b>Decline</b> a student’s submitted payment — tap <b>Receipt</b> to view their uploaded proof.",
    "<b>Mark Paid</b> records a payment yourself (e.g. cash in person): enter amount, method and month(s). "
        "It’s confirmed <b>instantly</b>. Cash needs no receipt; for UPI/bank you may attach one.",
    "Use the month buttons to go back to earlier months as needed.",
]))

story.append(H2("Notifications"))
story.append(P("You’re alerted about new bookings, reschedule requests, <b>student cancellations</b> and submitted payments. "
    "Tap to open; clear individually or all at once."))

story.append(PageBreak())

# ── 5. BOOKING AT A GLANCE ───────────────────────────────────────────────────
story += [H1("5.&nbsp; How booking works (at a glance)"), rule()]
story.append(table(
    ["Who acts", "Action", "Result"],
    [
        ["Student", "Books a free slot", "Confirmed instantly"],
        ["Student", "Books a taken slot", "Request → staff confirms"],
        ["Student", "Reschedules a class", "Request → staff confirms"],
        ["Student", "Cancels a class", "Cancelled at once → staff notified"],
        ["Teacher / Admin", "Books, reschedules or cancels", "Happens at once → student notified"],
    ],
    [38*mm, 62*mm, 65*mm]))

# ── 6. PAYMENTS AT A GLANCE ──────────────────────────────────────────────────
story += [H1("6.&nbsp; How payments work (at a glance)"), rule()]
story.append(table(
    ["Who acts", "Action", "Result"],
    [
        ["Student", "Submits a payment (+ receipt)", "Status <b>Pending</b>"],
        ["Teacher / Admin", "Confirms it", "Status <b>Paid</b>"],
        ["Teacher / Admin", "Declines it", "Student re-submits"],
        ["Teacher / Admin", "<b>Mark Paid</b> (records directly)", "<b>Paid</b> instantly"],
    ],
    [38*mm, 72*mm, 55*mm]))
story.append(Note("Cash payments don’t need a receipt upload. Receipts that are uploaded can be viewed by the teacher/admin."))

# ── 7. TIPS / FAQ ────────────────────────────────────────────────────────────
story += [H1("7.&nbsp; Tips, FAQ &amp; troubleshooting"), rule()]

story.append(H2("Frequently asked"))
faq = [
    ("How do I get an account?", "The Teacher or an Admin creates it and shares your email &amp; password."),
    ("I forgot my password.", "Contact the Teacher/Admin — they reset it for you."),
    ("Why are the times different from a classmate’s?", "Everyone sees times in their own timezone. Use the My time / Teacher’s time toggle while booking."),
    ("There’s a faint line across today on the calendar.", "That’s just the ‘current time’ marker — it shows where ‘now’ is. Not a class."),
    ("I changed my timezone but still see the old one.", "Switch away from the app and back — it refreshes your profile automatically."),
    ("The app looks out of date.", "Close and reopen it; it auto-updates to the latest version."),
]
for q, a in faq:
    story.append(Paragraph(f"<b>{q}</b>", ParagraphStyle("q", fontName="AppFont-Bold", fontSize=10.2, textColor=NAVY, leading=14, spaceBefore=4)))
    story.append(Paragraph(a, styles["Body"]))

story.append(H2("Good to know"))
story.append(bullets([
    "Works on phone and computer; install it to your home screen for an app-like experience.",
    "Your booking and payment actions save even on a slow connection.",
    "Important actions (cancel, delete, mark done) always ask for confirmation first.",
]))

story.append(Spacer(1, 8*mm))
story.append(thin())
story.append(Paragraph("Deva's Classes &mdash; thank you for being part of the studio.",
    ParagraphStyle("end", fontName="AppFont-Italic", fontSize=10, textColor=GRAY, alignment=TA_CENTER)))

doc.build(story)
print("WROTE:", OUT)
