// Hand-rolled SVG charts. No external deps.
// Returns SVG strings to inject via innerHTML.

import { esc } from "../lib/format.js";

const PAD = { top: 20, right: 24, bottom: 30, left: 56 };

export function lineChart(points, opts = {}) {
  const {
    width = 800,
    height = 240,
    color = "var(--accent)",
    fill = true,
  } = opts;
  if (!points || points.length < 2) {
    return `<div class="chart-empty">Not enough data</div>`;
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const sx = (x) => PAD.left + ((x - minX) / xRange) * innerW;
  const sy = (y) => PAD.top + innerH - ((y - minY) / yRange) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
    .join(" ");
  const fillPath =
    linePath +
    ` L ${sx(maxX).toFixed(1)} ${sy(0).toFixed(1)} L ${sx(minX).toFixed(1)} ${sy(0).toFixed(1)} Z`;

  const zeroY = sy(0);

  // Y-axis ticks: min, mid, max, plus 0 if it's in range.
  const ticks = uniqueSorted([minY, 0, maxY]);
  const tickLines = ticks
    .map((t) => {
      const y = sy(t).toFixed(1);
      return `
        <line x1="${PAD.left}" y1="${y}" x2="${width - PAD.right}" y2="${y}"
              stroke="var(--border)" stroke-width="1"
              stroke-dasharray="${t === 0 ? "0" : "2,3"}" opacity="${
        t === 0 ? 0.6 : 0.4
      }"/>
        <text x="${PAD.left - 8}" y="${y}" text-anchor="end" dy="0.32em"
              fill="var(--text-dim)" font-size="10" font-family="var(--font-mono)">${formatAxisNumber(
                t
              )}</text>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart" preserveAspectRatio="none">
      ${tickLines}
      ${
        fill
          ? `<path d="${fillPath}" fill="${color}" opacity="0.12"/>`
          : ""
      }
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;
}

export function barChart(items, opts = {}) {
  const {
    width = 800,
    height = 240,
    valueKey = "value",
    labelKey = "label",
    colorKey = null,
    positiveColor = "var(--profit)",
    negativeColor = "var(--loss)",
  } = opts;

  if (!items || items.length === 0) {
    return `<div class="chart-empty">No data</div>`;
  }

  const values = items.map((it) => it[valueKey]);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const range = maxV - minV || 1;

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const barCount = items.length;
  const slotW = innerW / barCount;
  const barW = Math.max(8, slotW * 0.65);

  const sy = (v) => PAD.top + innerH - ((v - minV) / range) * innerH;
  const zeroY = sy(0);

  const bars = items
    .map((it, i) => {
      const v = it[valueKey];
      const x = PAD.left + slotW * i + (slotW - barW) / 2;
      const y = v >= 0 ? sy(v) : zeroY;
      const h = Math.abs(sy(v) - zeroY);
      const color = it[colorKey] || (v >= 0 ? positiveColor : negativeColor);
      const labelX = x + barW / 2;
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(
        1
      )}" height="${h.toFixed(1)}" fill="${color}" opacity="0.85" rx="2"/>
        <text x="${labelX.toFixed(1)}" y="${
        height - PAD.bottom + 14
      }" text-anchor="middle" fill="var(--text-dim)" font-size="10" font-family="var(--font-mono)">${esc(
        it[labelKey]
      )}</text>
        <text x="${labelX.toFixed(1)}" y="${
        v >= 0 ? y - 4 : y + h + 12
      }" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)">${formatAxisNumber(
        v
      )}</text>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart" preserveAspectRatio="none">
      <line x1="${PAD.left}" y1="${zeroY.toFixed(1)}" x2="${
    width - PAD.right
  }" y2="${zeroY.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>
      ${bars}
    </svg>
  `;
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function formatAxisNumber(n) {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
