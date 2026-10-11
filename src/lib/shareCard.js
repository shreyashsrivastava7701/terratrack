// shareCard.js: draws the weekly or monthly summary card as a one-page PDF (4:5, Instagram shape).
// Everything is drawn with jsPDF shapes and text, so it stays sharp when zoomed.
// Numbers come from periodSummary() in calc.js.
import { jsPDF } from 'jspdf';
import { itemLabel } from '../data/labels.js';

const C = {
  page: '#f7fbfd', card: '#e8f3f8', ink: '#1c3341', soft: '#5d7383',
  sprout: '#23875a', sproutLight: '#d3f0df', sun: '#fff3cf', sunDark: '#7a5600', line: '#d3e5ee',
};

const fmtDate = (key) =>
  new Date(key + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function buildSharePdf(s, { name = '' } = {}) {
  const W = 405, H = 506;
  const doc = new jsPDF({ unit: 'pt', format: [W, H] });
  const fill = (hex) => doc.setFillColor(hex);
  const text = (hex) => doc.setTextColor(hex);

  fill(C.page); doc.rect(0, 0, W, H, 'F');

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); text(C.sprout);
  doc.text('TerraTrack', 24, 38);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); text(C.soft);
  const title = `${s.days === 7 ? 'My week' : 'My month'} · ${fmtDate(s.from)} to ${fmtDate(s.to)}`;
  doc.text(title, W - 24, 38, { align: 'right' });
  if (name) { doc.text(name, 24, 54); }

  // Big number
  fill(C.card); doc.roundedRect(20, 66, W - 40, 112, 14, 14, 'F');
  doc.setFontSize(11); text(C.soft); doc.text('Net carbon footprint', 36, 90);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(40); text(C.ink);
  doc.text(`${s.netKg.toFixed(1)} kg`, 36, 132);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); text(C.soft);
  doc.text(`CO2e over ${s.loggedDays} logged ${s.loggedDays === 1 ? 'day' : 'days'} · ${s.averageKg.toFixed(1)} kg a day (budget ${s.budgetKg} kg)`, 36, 156);
  doc.setFont('helvetica', 'bold'); text(C.sprout);
  doc.text(`${s.daysOnBudget} of ${s.loggedDays} days within budget`, 36, 170);

  // Contributions (the flex)
  fill(C.sproutLight); doc.roundedRect(20, 190, W - 40, 118, 14, 14, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); text(C.sprout);
  doc.text('What I did for the planet', 36, 212);
  const lines = [];
  if (s.savedKg > 0.005) lines.push(`Saved ${s.savedKg.toFixed(1)} kg vs my usual commute and meals`);
  if (s.creditsKg > 0.005) lines.push(`Earned ${s.creditsKg.toFixed(2)} kg of credits from eco actions`);
  if (s.treeKg > 0.0005) lines.push(`My trees absorbed ${s.treeKg.toFixed(2)} kg`);
  for (const [item, qty] of Object.entries(s.ecoCounts)) {
    lines.push(`${itemLabel(item)}: ${Math.round(qty * 10) / 10}${item === 'compost' ? ' kg' : item === 'tree' ? (qty === 1 ? ' tree' : ' trees') : (qty === 1 ? ' time' : ' times')}`);
  }
  if (lines.length === 0) lines.push('Just getting started. Next time: one eco action a day!');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); text(C.ink);
  lines.slice(0, 6).forEach((l, i) => doc.text(`•  ${l}`, 36, 232 + i * 13.5));

  // Where it came from
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); text(C.ink);
  doc.text('Where my emissions came from', 24, 334);
  const bars = s.sectors.slice(0, 4);
  bars.forEach((b, i) => {
    const y = 348 + i * 22;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); text(C.ink);
    doc.text(b.label, 24, y + 9);
    fill(C.line); doc.roundedRect(100, y + 2, 210, 9, 4.5, 4.5, 'F');
    fill(C.sprout); doc.roundedRect(100, y + 2, Math.max(9, 210 * b.share), 9, 4.5, 4.5, 'F');
    text(C.soft); doc.text(`${b.kg.toFixed(1)} kg · ${Math.round(b.share * 100)}%`, W - 24, y + 9, { align: 'right' });
  });
  if (bars.length === 0) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); text(C.soft); doc.text('Nothing logged yet.', 24, 356); }

  // Footer call to action
  fill(C.sun); doc.roundedRect(20, H - 62, W - 40, 40, 12, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); text(C.sunDark);
  doc.text('Every small swap counts. Track yours with TerraTrack.', W / 2, H - 45, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Approximate factors; a habit tool, not a certified carbon report.', W / 2, H - 31, { align: 'center' });

  return doc;
}

export function shareFileName(s) {
  return `terratrack-${s.days === 7 ? 'week' : 'month'}-${s.to}.pdf`;
}
