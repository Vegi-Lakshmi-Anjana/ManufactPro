// ============================================================
// ManufactPro — Stage 2 Calculation & Rendering Logic
// ============================================================

// --- Quality Index Calculation ---
function computeQuality(eps, N, nDef, temp) {
  let q = 5 - 0.8 * eps - 0.3 * N - 0.7 * nDef;
  if (temp === 'hot') q += 0.5;
  if (temp === 'cold') q -= 0.3;
  q = Math.max(0, Math.min(5, q));
  if (q >= 3.5) return { level: 'High', score: +q.toFixed(1), badge: 'good' };
  if (q >= 2.0) return { level: 'Medium', score: +q.toFixed(1), badge: 'warn' };
  return { level: 'Low', score: +q.toFixed(1), badge: 'bad' };
}

// --- Relative Cost Estimation ---
function computeCost(proc, N, F_kN, temp) {
  const pf = { rolling: 1, forging: 1.2, extrusion: 1.5 };
  const tf = { cold: 1, warm: 1.3, hot: 1.6 };
  let c = 1 * N + 0.001 * F_kN + pf[proc] + (tf[temp] - 1) * 0.8;
  if (N > 4) c += 1.5;
  if (c < 3) return { level: 'Low', badge: 'good' };
  if (c < 6) return { level: 'Medium', badge: 'warn' };
  return { level: 'High', badge: 'bad' };
}

// ============================================================
// STAGE 2: Engineering Calculations (each process independent)
// ============================================================
function runStage2() {
  try {
    const mat = document.getElementById('material').value;
    const temp = document.getElementById('tempCond').value;
    const { K, n } = MAT_DB[mat][temp];
    const results = {};

    shortlisted.forEach(p => {
      // Get process-specific machine capacity, friction, width
      const Fm_kN = parseFloat(document.getElementById(p + '_Fm')?.value);
      const mu = parseFloat(document.getElementById(p + '_mu')?.value) || 0.1;
      const b_mm = parseFloat(document.getElementById(p + '_b')?.value) || 200;

      if (!Fm_kN || isNaN(Fm_kN)) {
        results[p] = { error: `Enter ${p} machine capacity (kN).` };
        return;
      }
      const Fm_N = Fm_kN * 1000; // Convert kN to N

      let r = {};

      // ---- ROLLING ----
      if (p === 'rolling') {
        const t0 = parseFloat(document.getElementById('r_t0')?.value);
        const tf = parseFloat(document.getElementById('r_tf')?.value);
        const R_r = parseFloat(document.getElementById('r_R')?.value);
        if (!R_r || !t0 || !tf || tf >= t0) {
          results[p] = { error: 'Enter valid roll radius and ensure t₀ > t_f.' };
          return;
        }
        // Rolling strain: ε = ln(t₀/t_f)
        const eps = Math.log(t0 / tf);
        // Average flow stress: σ_avg = K·ε^n/(1+n) [MPa]
        const sigma_avg = K * Math.pow(eps, n) / (1 + n);
        // Contact length: L = √(R·Δt) [mm]
        const L = Math.sqrt(R_r * (t0 - tf));
        // Rolling force: F = σ_avg × b × L [N]
        // σ_avg in MPa = N/mm², b in mm, L in mm → F in N
        const F_req = sigma_avg * b_mm * L;
        // Draft limit: Δh_max = μ²·R [mm]
        const dh_max = mu * mu * R_r;
        // Number of passes
        const N_passes = Math.max(1, Math.ceil((t0 - tf) / dh_max));
        // Per-pass calculations
        const eps_pass = eps / N_passes;
        const sig_pass = K * Math.pow(Math.max(eps_pass, 1e-9), n) / (1 + n);
        const dh_pass = Math.min((t0 - tf), dh_max);
        const L_pass = Math.sqrt(R_r * dh_pass);
        const F_pass = sig_pass * b_mm * L_pass;
        // Feasibility (Machine Load Ratio)
        const P = F_req / Fm_N;
        const P_pass = F_pass / Fm_N;
        const DR = ((t0 - tf) / t0) * 100;
        const limitOK = (t0 - tf) <= dh_max + 0.001;
        // Defect analysis
        let defects = [];
        if (eps > 0.5) defects.push({ name: 'Edge Cracking', reason: `ε=${eps.toFixed(3)} > 0.5`, sev: temp === 'hot' ? 'warn' : 'bad' });
        if (N_passes > 4) defects.push({ name: 'Work Hardening Risk', reason: `${N_passes} passes → high accumulated strain`, sev: 'warn' });
        if (mu > 0.3) defects.push({ name: 'Surface Defects', reason: `High friction μ=${mu}`, sev: 'warn' });
        const Q = computeQuality(eps, N_passes, defects.length, temp);
        const cost = computeCost('rolling', N_passes, F_req / 1000, temp);

        r = { eps, sigma_avg, L, F_req, F_pass, P, P_pass, N: N_passes, dh_max, limitOK, defects, Q, cost, DR, t0, tf, R_r, K, n, mu, Fm_kN, b: b_mm, singleFeasible: F_req <= Fm_N, multipassFeasible: F_pass <= Fm_N };
      }

      // ---- FORGING (Open-Die) ----
      if (p === 'forging') {
        const h0 = parseFloat(document.getElementById('f_h0')?.value);
        const hf = parseFloat(document.getElementById('f_hf')?.value);
        const fContact = document.getElementById('f_contact')?.value || 'circ';

        if (!h0 || !hf || hf >= h0) {
          results[p] = { error: 'Enter valid heights and ensure h₀ > h_f.' };
          return;
        }

        // Forging strain: ε = ln(h₀/h_f) — same regardless of cross-section shape
        const eps = Math.log(h0 / hf);
        // Average flow stress [MPa]
        const sigma_avg = K * Math.pow(eps, n) / (1 + n);

        let A_mm2, Kf, charLen, extraInfo = {};

        if (fContact === 'rect') {
          // Flat-die forging → rectangular footprint (sheet/flat output)
          const Wf = parseFloat(document.getElementById('f_W')?.value);
          const Lf = parseFloat(document.getElementById('f_L')?.value);
          if (!Wf || !Lf) {
            results[p] = { error: 'Enter final Width (W_f) and Length (L_f) for rectangular forging.' };
            return;
          }
          // Contact area [mm²]
          A_mm2 = Wf * Lf;
          // Shape factor: K_f = 1 + (0.4μ × W_f) / H_f
          Kf = 1 + (0.4 * mu * Wf) / hf;
          charLen = Wf; // characteristic dimension for D/H analogue = W/H
          extraInfo = { Wf, Lf };
        } else {
          // Circular billet forging → circular footprint (rod/disk output)
          const Df = parseFloat(document.getElementById('f_D')?.value);
          if (!Df) {
            results[p] = { error: 'Enter final Diameter (D_f) for circular forging.' };
            return;
          }
          // Contact area [mm²]
          A_mm2 = Math.PI * Math.pow(Df, 2) / 4;
          // Shape factor: K_f = 1 + (0.4μ × D_f) / H_f
          Kf = 1 + (0.4 * mu * Df) / hf;
          charLen = Df;
          extraInfo = { Df };
        }

        // Forging force: F = K_f × σ_avg × A_contact [N]
        // σ_avg [MPa = N/mm²] × A [mm²] → F in N
        const F_req = Kf * sigma_avg * A_mm2;
        const DH_ratio = charLen / hf; // D/H or W/H ratio
        const N_passes = Math.max(1, Math.ceil((h0 - hf) / (0.4 * h0)));
        const P = F_req / Fm_N;
        const DR = ((h0 - hf) / h0) * 100;
        const limitOK = DH_ratio <= 3;

        // Defects
        let defects = [];
        if (DH_ratio > 3) defects.push({ name: 'Barreling', reason: `${fContact === 'rect' ? 'W' : 'D'}/H = ${DH_ratio.toFixed(2)} > 3`, sev: 'bad' });
        else if (DH_ratio > 2) defects.push({ name: 'Minor Barreling', reason: `${fContact === 'rect' ? 'W' : 'D'}/H = ${DH_ratio.toFixed(2)} in 2–3 range`, sev: 'warn' });
        if (eps > 0.6) defects.push({ name: 'Surface / Internal Cracks', reason: `ε=${eps.toFixed(3)} > 0.6`, sev: temp === 'hot' ? 'warn' : 'bad' });
        const Q = computeQuality(eps, N_passes, defects.length, temp);
        const cost = computeCost('forging', N_passes, F_req / 1000, temp);

        r = { eps, sigma_avg, Kf, A_mm2, F_req, P, N: N_passes, DH_ratio, charLen, fContact, limitOK, defects, Q, cost, DR, h0, hf, K, n, mu, Fm_kN, singleFeasible: F_req <= Fm_N, ...extraInfo };
      }

      // ---- EXTRUSION ----
      if (p === 'extrusion') {
        const d0e = parseFloat(document.getElementById('e_d0')?.value);
        const dfe = parseFloat(document.getElementById('e_df')?.value); // outer dia if tube
        const isTube = document.getElementById('e_df_inner') !== null;
        let dfe_in = 0;

        if (isTube) {
          dfe_in = parseFloat(document.getElementById('e_df_inner')?.value);
          if (!dfe_in || dfe_in >= dfe) {
            results[p] = { error: 'For tubes, ensure Inner Diameter < Outer Diameter and both are positive.' };
            return;
          }
        }

        if (!d0e || !dfe || dfe >= d0e) {
          results[p] = { error: 'Ensure initial diameter is larger than final outer diameter.' };
          return;
        }

        // Areas [mm²]
        const A0 = Math.PI * Math.pow(d0e, 2) / 4;
        const Af = isTube
          ? (Math.PI / 4) * (Math.pow(dfe, 2) - Math.pow(dfe_in, 2))
          : Math.PI * Math.pow(dfe, 2) / 4;

        // Extrusion strain: ε = ln(A₀/A_f)
        const eps = Math.log(A0 / Af);
        // Average flow stress [MPa]
        const sigma_avg = K * Math.pow(eps, n) / (1 + n);
        // Ram pressure: p = σ_avg × (0.8 + 1.3·ln(A₀/A_f)) [MPa]
        const ram_p = sigma_avg * (0.8 + 1.3 * eps);
        // Extrusion force: F = A₀ × p_ram [N]
        // A₀ in mm², ram_p in MPa=N/mm² → F in N
        const F_req = A0 * ram_p;
        const P = F_req / Fm_N;
        const ER = A0 / Af;
        const DR = ((A0 - Af) / A0) * 100;
        const limitOK = ER <= 10 && eps <= 2.0;
        // Defects
        let defects = [];
        if (eps > 1.5) defects.push({ name: 'Central Burst', reason: `ε=${eps.toFixed(3)} > 1.5`, sev: temp === 'hot' ? 'warn' : 'bad' });
        if (ER > 10) defects.push({ name: 'Die Failure Risk', reason: `ER = ${ER.toFixed(2)} > 10`, sev: 'bad' });
        if (mu > 0.15 && temp === 'cold') defects.push({ name: 'Surface Tearing', reason: `High friction in cold extrusion`, sev: 'warn' });
        const Q = computeQuality(eps, 1, defects.length, temp);
        const cost = computeCost('extrusion', 1, F_req / 1000, temp);

        r = { eps, sigma_avg, ram_p, F_req, P, ER, limitOK, defects, Q, cost, DR, d0e, dfe, A0, Af, K, n, Fm_kN, singleFeasible: F_req <= Fm_N };
      }

      results[p] = r;
    });

    renderStage2(results);
  } catch (err) {
    alert('Error in Stage 2: ' + err.message);
  }
}

// ============================================================
// RENDER Stage 2 Results
// ============================================================
function renderStage2(results) {
  const cols = { rolling: 'var(--rolling)', forging: 'var(--accent2)', extrusion: 'var(--extrusion)' };
  let html = '';

  shortlisted.forEach(p => {
    const r = results[p];
    const col = cols[p];
    if (r.error) {
      html += `<div class="panel" style="border-color:${col}40">
        <div class="panel-title" style="color:${col};--accent:${col}">${p.toUpperCase()}</div>
        <div class="err-box">⚠ ${r.error}</div></div>`;
      return;
    }
    const Fkn = (r.F_req / 1000).toFixed(1);

    // Machine Load Formatting (e.g. 80%, 120%)
    const loadPct = (r.P * 100).toFixed(1);
    const pColor = r.singleFeasible ? (r.P < 0.85 ? 'var(--good)' : 'var(--warn)') : 'var(--danger)';

    // Defects HTML
    let defHtml = '';
    if (r.defects.length === 0) defHtml = `<span class="badge badge-good">No significant defects predicted</span>`;
    else r.defects.forEach(d => {
      defHtml += `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">
        <span class="badge badge-${d.sev}">${d.name}</span>
        <span style="font-size:.76rem;color:var(--muted)">${d.reason}</span>
      </div>`;
    });

    // Feasibility note
    let feasNote = '';
    if (r.singleFeasible) {
      feasNote = `<div class="good-box">✔ Single-pass feasible. Machine Load = ${loadPct}% of capacity (${r.Fm_kN} kN).</div>`;
    } else if (p === 'rolling' && r.multipassFeasible) {
      const passLoad = (r.P_pass * 100).toFixed(1);
      feasNote = `<div class="warn-box">⚠ Single-pass force (${Fkn} kN) overloads mill at ${loadPct}% capacity.<br>→ Recommend ${r.N} passes. Per-pass load = ${passLoad}% — feasible.</div>`;
    } else if (p === 'forging' && r.N > 1) {
      feasNote = `<div class="warn-box">⚠ Single-pass force (${Fkn} kN) overloads press at ${loadPct}%.<br>→ Recommend ${r.N} incremental forging passes.</div>`;
    } else {
      feasNote = `<div class="err-box">✕ Required force (${Fkn} kN) overloads machine at ${loadPct}%.${p === 'extrusion' ? ' Multipass not permitted for extrusion.' : ''} Consider higher-capacity equipment.</div>`;
    }

    // Process-specific details
    let specific = '';
    if (p === 'rolling') {
      specific = `<div class="info-row" style="margin-top:.8rem">
        <div class="info-item">L (contact): <strong>${r.L.toFixed(2)} mm</strong></div>
        <div class="info-item">Δh_max: <strong>${r.dh_max.toFixed(3)} mm</strong></div>
        <div class="info-item">Passes: <strong>${r.N}</strong></div>
        <div class="info-item">Draft: <span class="badge badge-${r.limitOK ? 'good' : 'warn'}">${r.limitOK ? 'Within limit' : 'Multipass required'}</span></div>
      </div>`;
    }
    if (p === 'forging') {
      const ratioLabel = r.fContact === 'rect' ? 'W/H' : 'D/H';
      const shapeDetail = r.fContact === 'rect'
        ? `W_f=${r.Wf} mm, L_f=${r.Lf} mm → A=${r.A_mm2.toFixed(1)} mm²`
        : `D_f=${r.Df} mm → A=π·D²/4=${r.A_mm2.toFixed(1)} mm²`;
      specific = `<div class="info-row" style="margin-top:.8rem">
        <div class="info-item">K_f: <strong>${r.Kf.toFixed(3)}</strong></div>
        <div class="info-item">${ratioLabel}: <strong>${r.DH_ratio.toFixed(2)}</strong></div>
        <div class="info-item">Contact: <strong>${shapeDetail}</strong></div>
        <div class="info-item">Passes: <strong>${r.N}</strong></div>
        <div class="info-item">${ratioLabel}≤3: <span class="badge badge-${r.limitOK ? 'good' : 'bad'}">${r.limitOK ? 'OK' : 'Barreling risk'}</span></div>
      </div>`;
    }

    if (p === 'extrusion') {
      specific = `<div class="info-row" style="margin-top:.8rem">
        <div class="info-item">Ram Pressure: <strong>${r.ram_p.toFixed(1)} MPa</strong></div>
        <div class="info-item">ER: <strong>${r.ER.toFixed(2)}</strong></div>
        <div class="info-item">A₀: <strong>${r.A0.toFixed(1)} mm²</strong></div>
        <div class="info-item">A_f: <strong>${r.Af.toFixed(1)} mm²</strong></div>
        <div class="info-item">Limit: <span class="badge badge-${r.limitOK ? 'good' : 'bad'}">${r.limitOK ? 'OK' : 'Exceeded'}</span></div>
      </div>`;
    }

    html += `<div class="panel" style="border-color:${col}40">
      <div class="panel-title" style="color:${col};--accent:${col}">${p.toUpperCase()} — Engineering Results</div>
      <div class="metric-grid">
        <div class="metric-box">
          <div class="metric-val" style="color:var(--accent);font-size:.92rem">${r.eps.toFixed(4)}</div>
          <div class="metric-lbl">True Strain ε</div>
        </div>
        <div class="metric-box">
          <div class="metric-val" style="font-size:.9rem">${r.sigma_avg.toFixed(1)} <span style="font-size:.6rem">MPa</span></div>
          <div class="metric-lbl">Avg Flow Stress σ_avg</div>
        </div>
        <div class="metric-box">
          <div class="metric-val" style="font-size:.9rem">${Fkn} <span style="font-size:.6rem">kN</span></div>
          <div class="metric-lbl">Required Force F_req</div>
        </div>
        <div class="metric-box">
          <div class="metric-val" style="color:${pColor}">${loadPct}%</div>
          <div class="metric-lbl">Machine Load</div>
        </div>
        <div class="metric-box">
          <span class="badge badge-${r.Q.badge}" style="font-size:.78rem">${r.Q.level} (${r.Q.score}/5)</span>
          <div class="metric-lbl" style="margin-top:.3rem">Quality Index</div>
        </div>
        <div class="metric-box">
          <span class="badge badge-${r.cost.badge}" style="font-size:.78rem">${r.cost.level}</span>
          <div class="metric-lbl" style="margin-top:.3rem">Relative Cost</div>
        </div>
      </div>
      ${specific}${feasNote}
      <div style="margin-top:.9rem">
        <div style="font-family:'DM Mono',monospace;font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.45rem">Defect Analysis</div>
        ${defHtml}
      </div>
      <div style="margin-top:.7rem;font-size:.74rem;color:var(--muted);font-family:'DM Mono',monospace">
        K=${r.K} MPa | n=${r.n} | % Reduction=${r.DR.toFixed(1)}%
      </div>
    </div>`;
  });

  document.getElementById('s2results').innerHTML = html;
  document.getElementById('s2results').classList.remove('hidden');
  buildFinalDecision(results);
  document.getElementById('s2results').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
// Final Decision — Weighted scoring across all criteria
// ============================================================
function buildFinalDecision(results) {
  // If all processes errored out, don't build a final decision
  const hasValidResult = shortlisted.some(p => !results[p].error);
  if (!hasValidResult) {
    document.getElementById('finalDecision').innerHTML = '';
    document.getElementById('finalDecision').classList.add('hidden');
    return;
  }

  const finalScores = {};

  shortlisted.forEach(p => {
    const r = results[p];
    if (r.error) { finalScores[p] = -999; return; }

    // Start with Stage 1 score
    let score = stage1Scores[p].S;

    // Force feasibility weighting (most important: 0.35)
    // r.P is Machine Load: penalize heavily if > 100%, reward if safely under 70%
    if (!r.singleFeasible) score -= 2;
    else if (r.P < 0.70) score += 0.5;

    // Multipass penalty (0.15 weight)
    const N = r.N || 1;
    score -= 0.2 * Math.max(0, N - 1);
    if (N > 4) score -= 1;

    // Defect severity penalty (0.20 weight)
    score -= (r.defects || []).filter(d => d.sev === 'bad').length * 0.8;
    score -= (r.defects || []).filter(d => d.sev === 'warn').length * 0.3;

    // Quality bonus/penalty (0.15 weight)
    if (r.Q.level === 'High') score += 0.5;
    if (r.Q.level === 'Low') score -= 0.8;

    // Cost (0.15 weight)
    if (r.cost.level === 'Low') score += 0.3;
    if (r.cost.level === 'High') score -= 0.5;

    // Process limit check
    if (!r.limitOK) score -= 1;

    finalScores[p] = score;
  });

  const winner = shortlisted.reduce((a, b) => finalScores[a] > finalScores[b] ? a : b);
  const wr = results[winner];
  const wCol = winner === 'rolling' ? 'var(--rolling)' : winner === 'forging' ? 'var(--accent2)' : 'var(--extrusion)';

  const reasons = [];
  reasons.push(`Highest combined score: Stage 1 = ${stage1Scores[winner].S}, Final = ${finalScores[winner].toFixed(2)}`);
  if (wr.singleFeasible) reasons.push(`Force feasible in single pass — machine load is ${(wr.P * 100).toFixed(1)}%`);
  else reasons.push(`Force exceeds single pass capacity, manageable via ${wr.N || '—'} multipass operation(s)`);
  if (wr.limitOK) reasons.push('All process limits (D/H, draft, extrusion ratio) satisfied');
  else reasons.push('⚠ Process limit check failed — monitor carefully');
  reasons.push(`Quality: ${wr.Q.level} (${wr.Q.score}/5) | Cost: ${wr.cost.level}`);
  if (wr.defects.length === 0) reasons.push('No significant defects predicted');
  else reasons.push(`Predicted defects: ${wr.defects.map(d => d.name).join(', ')} — apply controls`);

  const scoreRow = shortlisted.map(p => {
    const iW = p === winner;
    return `<div style="text-align:center;padding:.5rem 1.1rem;border-radius:8px;background:var(--surface2);border:1px solid ${iW ? wCol : 'var(--border)'}">
      <div style="font-family:'DM Mono',monospace;font-size:1rem;color:${iW ? wCol : 'var(--muted)'}">${finalScores[p].toFixed(2)}</div>
      <div style="font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-top:.2rem">${p}</div>
    </div>`;
  }).join('');

  const html = `<div class="decision-box">
    <div style="font-family:'DM Mono',monospace;font-size:.68rem;color:var(--muted);letter-spacing:2px;text-transform:uppercase">Recommended Best Process</div>
    <div class="decision-process" style="color:${wCol}">${winner.toUpperCase()}</div>
    <div style="display:flex;justify-content:center;gap:.75rem;margin:.75rem 0">${scoreRow}</div>
    <div class="decision-reasons">${reasons.map(r => `<div class="reason-item">${r}</div>`).join('')}</div>
  </div>`;

  document.getElementById('finalDecision').innerHTML = html;
  document.getElementById('finalDecision').classList.remove('hidden');
  document.getElementById('finalDecision').scrollIntoView({ behavior: 'smooth' });
}
