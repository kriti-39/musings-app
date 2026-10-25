// Writes the fee report to a PDF. jsPDF is imported on demand so it never
// weighs down the app for the students, who can't open this at all.
//
// Amounts are written as "Rs." rather than the rupee sign: jsPDF's built-in
// fonts have no glyph for it, and it would come out as a stray character.

import { periodLabel, reportFileName } from './feeReport'

const AMBER = [245, 158, 11]
const INK = [31, 41, 55]
const MUTED = [107, 114, 128]

// "28 Sep" — the date the money arrived, which is the whole point of this report.
function fmtDay(d) {
  if (!d) return '-'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const rs = n => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`

// Builds the document. Separated from the download so the layout can be
// exercised without a browser.
export async function buildFeeReportDoc(report, { studioName = "Deva's Classes" } = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = margin

  // ── Heading ──
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK)
  doc.text('Fee Report', margin, y)
  y += 18
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED)
  doc.text(`${studioName}  ·  ${periodLabel(report.period)}`, margin, y)
  y += 13
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    margin, y,
  )
  y += 20

  // ── Summary strip ──
  const t = report.totals
  // No "with dues" and no "outstanding": on credits a class cannot be booked
  // until it is paid for, so a debt is not a state a student can be in.
  const summary = [
    ['Students', String(t.students)],
    ['Paid', String(t.paidCount)],
    ['Received', rs(t.received)],
    ...(t.classesDone !== null ? [['Classes done', String(t.classesDone)]] : []),
    ...(t.awaitingCount ? [['To confirm', rs(t.awaiting)]] : []),
  ]
  const boxW = (pageWidth - margin * 2) / summary.length
  doc.setDrawColor(229, 231, 235).setLineWidth(0.7)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 44, 4, 4)
  summary.forEach(([label, value], i) => {
    const x = margin + boxW * i + 10
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
    doc.text(label.toUpperCase(), x, y + 16)
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK)
    doc.text(value, x, y + 32)
  })
  y += 60

  const tableBase = {
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: [229, 231, 235] },
    headStyles: { fillColor: AMBER, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    margin: { left: margin, right: margin },
  }

  function sectionHeading(title, note) {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK)
    doc.text(title, margin, y)
    // Measure while the heading's own font is still active — measuring after
    // switching to the smaller note font puts the note on top of the title.
    const titleWidth = doc.getTextWidth(title)
    if (note) {
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED)
      doc.text(note, margin + titleWidth + 8, y)
    }
    y += 10
  }

  // ── 1. What came in ──
  if (report.paid.length) {
    sectionHeading('Received', `${report.paid.length} student${report.paid.length > 1 ? 's' : ''}`)
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Student', 'Country', 'Paid on', 'Classes', 'Received']],
      body: report.paid.map(r => [
        r.name,
        r.country || '-',
        r.paidOn.map(x => fmtDay(x.date)).join(', ') || '-',
        r.classesDone === null ? '-' : String(r.classesDone),
        rs(r.received),
      ]),
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { halign: 'center' },
        4: { halign: 'right', textColor: [21, 128, 61] },
      },
    })
    y = doc.lastAutoTable.finalY + 24
  }

  // ── 2. Submitted but not yet confirmed (staff action, not chasing) ──
  if (report.awaiting.length) {
    if (y > doc.internal.pageSize.getHeight() - 140) { doc.addPage(); y = margin }
    sectionHeading('Awaiting your confirmation', 'payment recorded, not yet verified')
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Student', 'Phone', 'Amount']],
      body: report.awaiting.map(r => [r.name, r.phone || '-', rs(r.awaiting)]),
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right', textColor: [180, 83, 9] } },
    })
    y = doc.lastAutoTable.finalY + 24
  }

  // ── 3. Nobody paid in this period. Not a list to chase — a student who
  //       bought nothing simply had classes left, or took a break. ──
  if (report.quiet.length) {
    if (y > doc.internal.pageSize.getHeight() - 140) { doc.addPage(); y = margin }
    sectionHeading('No payment in this period', `${report.quiet.length} student${report.quiet.length > 1 ? 's' : ''}`)
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Student', 'Country', 'Classes']],
      body: report.quiet.map(r => [
        r.name,
        r.country || '-',
        r.classesDone === null ? '-' : String(r.classesDone),
      ]),
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' } },
    })
    y = doc.lastAutoTable.finalY + 24
  }

  if (!report.paid.length && !report.awaiting.length && !report.quiet.length) {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED)
    doc.text('No fee records for this period.', margin, y)
  }

  // ── Footnotes + page numbers ──
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED)
    doc.text(
      'A payment covering several months is counted once, at its full amount. Dues are shown only for students on a monthly fee.',
      margin, h - 26,
    )
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, h - 26, { align: 'right' })
  }

  return doc
}

export async function downloadFeeReport(report, opts) {
  const doc = await buildFeeReportDoc(report, opts)
  const name = reportFileName(report.period)
  try {
    doc.save(name)
  } catch {
    // Some in-app browsers block the download; show it instead so it can still
    // be saved or shared from the viewer.
    window.open(doc.output('bloburl'), '_blank')
  }
  return name
}
