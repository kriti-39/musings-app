# Musings with Deva — Standard Operating Procedure (SOP)

**App URL:** https://musings-app-pied.vercel.app
**Last updated:** May 2026

This guide explains how to use the Musings with Deva class-management app for each role: **Teacher**, **Admin**, and **Student**.

---

## 1. Overview

Musings with Deva is a web app (works on phone and computer) for managing private music classes. It handles:

- Class scheduling, booking requests, rescheduling, and cancellation
- Fee tracking and payment confirmation
- Lesson notes
- In-app notifications
- Student management

**There are 3 roles:**

| Role | Who | What they can do |
|------|-----|------------------|
| **Teacher** | Debapriya | Everything — runs the studio, creates admins |
| **Admin** | 2–3 assistants | Almost everything the teacher can, manages students & payments |
| **Student** | Each learner | Books classes, pays fees, sees their own schedule |

---

## 2. Logging In

1. Open **https://musings-app-pied.vercel.app** in any browser (Chrome recommended).
2. Enter your **email** and **password**.
3. Tap **Sign In**.

**You stay logged in** until you tap *Sign out* yourself — even if you close the browser or restart your phone. You only need to log in once per device.

**Tip — Install as an app:** In Chrome, tap the **⋮** menu → **Add to Home screen**. It then opens like a normal app.

---

## 3. First-Time Setup (Order matters)

This is the one-time setup chain when starting fresh:

```
1. Teacher account is created (in Firebase — already done)
        ↓
2. Teacher logs in → creates Admin accounts
        ↓
3. Teacher or Admin creates Student accounts
        ↓
4. Students log in and start booking
```

---

## 4. TEACHER SOP

### 4.1 Create an Admin
1. Sidebar → **Students**
2. Switch to the **Admins** tab (top of page)
3. Click **+ Add Admin**
4. Enter **Name**, **Email**, **Password** (min 6 characters)
5. Click **Create Admin**
6. Share the email + password with that person.

### 4.2 Add a Student
1. Sidebar → **Students** → **Students** tab
2. Click **+ Add Student**
3. Fill in name, email, password, country, timezone, and fee details
4. Click **Add Student**
5. Share the login email + password with the student.

### 4.3 Confirm or Reject a Booking Request
When a student requests a class, you get a notification (🔔 bell, top-right).
1. Go to **Dashboard** → **Booking Requests** section
2. Click **Confirm** (locks the slot) or **Reject**
3. The student is notified automatically.

### 4.4 Schedule a Class Yourself
1. Sidebar → **Schedule**
2. Either click **+ Schedule Class**, or click a date → day view → click a time slot
3. Pick the student, date, time, duration, and (optional) lesson topic
4. For repeating classes, tick **Make this a recurring class**
5. Click **Schedule Class**

### 4.5 Reschedule / Cancel a Class
1. Sidebar → **Schedule** or **Classes**
2. Click the class
3. Choose **Reschedule** (pick new date/time) or **Cancel Class**
4. The student is notified.

### 4.6 Block Your Unavailable Time
1. Sidebar → **Schedule** → **Availability**
2. Set the date, start time, end time, and optional reason
3. Click **Block this slot**
4. Students will see this as "unavailable" and cannot book it.
*(Reasons are private — students only see that the time is blocked.)*

### 4.7 Add Lesson Notes / Mark Done
1. Open the class from **Schedule** or **Classes**
2. **Add Notes** → type the lesson topic → **Save**
3. **Mark as Done** when the class is completed.

### 4.8 Confirm a Payment
1. Sidebar → **Fees**
2. Find the student with "Pending confirmation" status
3. Click **Confirm**
4. The student is notified their payment is verified.

### 4.9 View a Student's Full History
1. Sidebar → **Students** → click the student's name
2. See their classes, payment history, and recurring schedules.

### 4.10 Deactivate a Student
1. Sidebar → **Students**
2. Click **Deactivate** next to their name
3. They move to the **Deactivated** tab (data is kept, can be reactivated anytime).

---

## 5. ADMIN SOP

Admins can do **everything the teacher can, except create other admins.** All admins and the teacher share **one calendar** — anything an admin schedules or blocks appears on the teacher's calendar too.

Key tasks:
- **Add students:** Sidebar → **Students** → **+ Add Student**
- **Confirm/reject bookings:** Dashboard → Booking Requests
- **Schedule / reschedule / cancel classes:** Schedule page
- **Block availability:** Schedule → Availability
- **Confirm payments:** Fees → Confirm (or **Mark Paid** for cash/manual)
- **View student detail:** Students → click a name
- **Deactivate students:** Students → Deactivate

*(Follow the same steps as the Teacher SOP sections 4.2–4.10.)*

---

## 6. STUDENT SOP

### 6.1 Book a Class
1. Sidebar → **Book a Class**
2. In **Month** view, tap a future date → it opens **Day** view
3. Tap an open time slot (red slots are unavailable)
4. Set the duration and an optional note
5. Tap **Send Request**
6. Wait for the teacher to confirm — you'll get a 🔔 notification.

### 6.2 See My Classes
- Sidebar → **My Classes**
- Three tabs: **Upcoming**, **Completed**, **Cancelled**
- Times shown in your own timezone.

### 6.3 Reschedule or Cancel My Class
1. **My Classes** → **Upcoming**
2. On a confirmed class: **Reschedule** (pick new time — teacher re-confirms) or **Cancel**
3. On a pending request: **Cancel Request**

### 6.4 Mark a Class Done
- After a class, tap **Mark Done** on that class card.

### 6.5 Pay Fees
1. Sidebar → **Fees**
2. Tap **Submit Payment**
3. Choose the month(s), amount, and method
4. Optionally upload a payment screenshot
5. Tap **Submit**
6. Status shows **Pending** until the teacher/admin confirms it, then **Confirmed**.

### 6.6 Change Password / Timezone
- Sidebar → **Settings**
- Update your password, or your timezone.

---

## 7. Notifications

- The 🔔 bell (top-right) shows updates and refreshes automatically every 30 seconds.
- You're notified when:
  - A booking is confirmed / rejected (student)
  - A class is rescheduled / cancelled by staff (student)
  - A payment is confirmed (student)
  - A new booking or reschedule request comes in (teacher + admins)

---

## 8. Fee Status Meaning

| Status | Meaning |
|--------|---------|
| **Unpaid** | No payment recorded for that month |
| **Pending confirmation** | Student submitted, awaiting staff verification |
| **Paid / Confirmed** | Verified by teacher or admin |

- If a **student** submits a payment → it stays **Pending** until staff confirm.
- If **staff** marks a payment (Mark Paid) → it's instantly **Confirmed**.

---

## 9. Quick Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank/white screen | Refresh the page. If it persists, clear browser cache. |
| Can't log in | Double-check email/password. Passwords are case-sensitive. |
| "Add Admin" button missing | You must be on the **Admins** tab (teacher only). |
| Don't see new notification | Wait 30s or refresh — the bell auto-updates. |
| Forgot password | Go to **Settings → Change Password** (while logged in), or ask the teacher/admin to reset it. |
| Class not showing | Make sure it was confirmed (not still pending). |

---

## 10. Golden Rules

1. **Students request, staff confirm.** No class is final until confirmed.
2. **One shared calendar** — teacher and all admins see and manage the same schedule.
3. **Students only see their own data** plus the teacher's blocked times. They never see other students.
4. **Stay logged in** — log in once per device; only sign out if you want to switch accounts.
5. **Deactivating ≠ deleting** — a deactivated student's history is preserved and can be restored.
