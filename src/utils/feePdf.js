// Writes the fee report to a PDF. jsPDF is imported on demand so it never
// weighs down the app for the students, who can't open this at all.
//
// Amounts are written as "Rs." rather than the rupee sign: jsPDF's built-in
// fonts have no glyph for it, and it would come out as a stray character.

import { monthsLabel, periodLabel, reportFileName } from './feeReport'

const AMBER = [245, 158, 11]
const INK = [31, 41, 55]
const MUTED = [107, 114, 128]

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
  const summary = [
    ['Students', String(t.students)],
    ['Paid', String(t.fullyPaid)],
    ['With dues', String(t.withDues)],
    ['Awaiting', String(t.awaiting)],
    ['Received', rs(t.received)],
    ['Outstanding', t.outstandingUnknown ? `${rs(t.outstanding)} +` : rs(t.outstanding)],
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

  // ── 1. Still to collect ──
  if (report.toCollect.length) {
    sectionHeading('To collect', `${report.toCollect.length} student${report.toCollect.length > 1 ? 's' : ''}`)
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Student', 'Phone', 'Country', 'Months not paid', 'Due']],
      body: report.toCollect.map(r => [
        r.name,
        r.phone || '-',
        r.country || '-',
        monthsLabel(r.unpaid),
        r.due === null ? '-' : rs(r.due),
      ]),
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { textColor: [185, 28, 28] },
        4: { halign: 'right' },
      },
    })
    y = doc.lastAutoTable.finalY + 24
  }

  // ── 2. Submitted but not yet confirmed (staff action, not chasing) ──
  if (report.awaiting.length) {
    if (y > doc.internal.pageSize.getHeight() - 140) { doc.addPage(); y = margin }
    sectionHeading('Awaiting your confirmation', 'payment submitted, not yet verified')
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Student', 'Phone', 'Months']],
      body: report.awaiting.map(r => [r.name, r.phone || '-', monthsLabel(r.pending)]),
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { textColor: [180, 83, 9] } },
    })
    y = doc.lastAutoTable.finalY + 24
  }

  // ── 3. Paid in full ──
  if (report.settled.length) {
    if (y > doc.internal.pageSize.getHeight() - 140) { doc.addPage(); y = margin }
    sectionHeading('Paid', `${report.settled.length} student${report.settled.length > 1 ? 's' : ''}`)
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Student', 'Country', 'Months paid', 'Received']],
      body: report.settled.map(r => [
        r.name,
        r.country || '-',
        monthsLabel(r.paid),
        rs(r.received),
      ]),
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { textColor: [21, 128, 61] },
        3: { halign: 'right' },
      },
    })
    y = doc.lastAutoTable.finalY + 24
  }

  if (!report.toCollect.length && !report.awaiting.length && !report.settled.length) {
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
