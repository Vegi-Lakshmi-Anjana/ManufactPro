// ============================================================
// ManufactPro — Manufacturing Process Selection Tool
// Complete engineering logic for Rolling, Open-Die Forging, Extrusion
// ============================================================

// --- Dynamic Dimension Labels ---
function updateDimensionLabels() {
    const red = document.getElementById('redType').value;
    const lblD0 = document.getElementById('lblD0');
    const lblDf = document.getElementById('lblDf');
    const labelMap = {
        thickness: { d0: 'Initial Thickness', df: 'Final Thickness' },
        height: { d0: 'Initial Height', df: 'Final Height' },
        area: { d0: 'Initial Diameter', df: 'Final Diameter' }
    };
    const m = labelMap[red] || labelMap.thickness;
    lblD0.innerHTML = `${m.d0} <span class="unit">(mm)</span>`;
    lblDf.innerHTML = `${m.df} <span class="unit">(mm)</span>`;
}

// --- Material Database: K (MPa), n (strain hardening exponent) ---
// Values vary by material AND temperature condition
const MAT_DB = {
    steel: { cold: { K: 700, n: 0.20 }, warm: { K: 400, n: 0.18 }, hot: { K: 200, n: 0.15 } },
    aluminum: { cold: { K: 200, n: 0.30 }, warm: { K: 120, n: 0.27 }, hot: { K: 80, n: 0.25 } },
    copper: { cold: { K: 300, n: 0.35 }, warm: { K: 180, n: 0.30 }, hot: { K: 100, n: 0.25 } },
    titanium: { cold: { K: 900, n: 0.15 }, warm: { K: 600, n: 0.13 }, hot: { K: 350, n: 0.10 } },
    brittle: { cold: { K: 800, n: 0.10 }, warm: { K: 500, n: 0.09 }, hot: { K: 250, n: 0.08 } }
};

// ----------------------------------------------------------------
// Geometry Compatibility Scores (0–10)
// Only physically valid input→output combinations are listed.
// FORGING CONTACT TYPE: 'rect' = flat-die (width×length), 'circ' = circular (πD²/4)
// ----------------------------------------------------------------
const GEO_SCORES = {
    // SLAB inputs  → output shapes achievable from a flat starting form
    'slab-sheet': { rolling: 10, forging: 0, extrusion: 0 },  // Sheet is too thin for forging -> Rolling ONLY
    'slab-flat': { rolling: 8, forging: 7, extrusion: 0 },    // Flat bar is thicker -> Both are valid

    // BILLET inputs → cylindrical starting form
    'billet-rod': { rolling: 6, forging: 7, extrusion: 10 },
    'billet-flat': { rolling: 3, forging: 9, extrusion: 2 },
    'billet-tube': { rolling: 0, forging: 0, extrusion: 10 }, // Tube -> Extrusion ONLY
};

// Forging contact geometry: which area formula to use in Stage 2
// 'rect' → area = width_f × length_f  (flat/sheet outputs)
// 'circ' → area = π × D_f² / 4       (rod/disk outputs)
const FORGING_CONTACT = {
    'slab-sheet': 'rect',
    'slab-flat': 'rect',
    'slab-rod': 'circ',
    'billet-rod': 'circ',
    'billet-flat': 'rect',
    'billet-tube': 'circ',
    'rod-rod': 'circ',
    'rod-flat': 'rect',
};

// Valid output choices for each input geometry
const VALID_OUTPUTS = {
    slab: ['sheet', 'flat'],
    billet: ['rod', 'tube', 'flat']
};

function getGeo(i, o) { return GEO_SCORES[i + '-' + o] || { rolling: 0, forging: 0, extrusion: 0 }; }
function getForgingContact(i, o) { return FORGING_CONTACT[i + '-' + o] || 'circ'; }

// Dynamically filter output options based on selected input geometry
function updateOutputOptions() {
    const inp = document.getElementById('inputGeo').value;
    const outSel = document.getElementById('outputGeo');
    const valid = VALID_OUTPUTS[inp] || [];
    Array.from(outSel.options).forEach(opt => {
        opt.hidden = !valid.includes(opt.value);
        opt.disabled = !valid.includes(opt.value);
    });
    // If current selection is now invalid, pick first valid
    if (!valid.includes(outSel.value)) outSel.value = valid[0];
    syncReductionType(); // also update reduction type when input changes
}

// Auto-set reduction type and dimension labels from output geometry
// Reduction type is NOT a free choice — it is physically determined by output shape:
//   Sheet / Flat → thickness reduction (the compressed dimension IS the thickness)
//   Rod / Tube   → area/diameter reduction (cross-section shrinks)
const RED_TYPE_MAP = {
    sheet: { red: 'thickness', label: 'Thickness  (t₀ → t_f)', d0: 'Initial Thickness', df: 'Final Thickness' },
    flat: { red: 'thickness', label: 'Thickness  (t₀ → t_f)', d0: 'Initial Thickness', df: 'Final Thickness' },
    rod: { red: 'area', label: 'Diameter  (d₀ → d_f)', d0: 'Initial Diameter', df: 'Final Diameter' },
    tube: { red: 'area', label: 'Diameter  (d₀ → d_f)', d0: 'Initial Diameter', df: 'Final Diameter' },
};

function syncReductionType() {
    const out = document.getElementById('outputGeo').value;
    const m = RED_TYPE_MAP[out] || RED_TYPE_MAP.sheet;
    // Write to the hidden input that Stage 1 reads
    document.getElementById('redType').value = m.red;
    // Update the amber read-only display
    const disp = document.getElementById('redTypeDisplay');
    if (disp) disp.value = m.label;
    // Update dimension labels
    document.getElementById('lblD0').innerHTML = `${m.d0} <span class="unit">(mm)</span>`;
    document.getElementById('lblDf').innerHTML = `${m.df} <span class="unit">(mm)</span>`;
}

function updateDimensionLabels() { syncReductionType(); } // alias for safety

// --- Reduction Type Scores ---
// NOTE: 'thickness' and 'height' are physically the SAME act (compressing a dimension
// between two flat surfaces). The label differs by convention:
//   Rolling   → called "thickness" reduction
//   Forging   → called "height" reduction  (but same physics)
// Since reduction type is auto-derived from output geometry:
//   Sheet/Flat  → thickness → Rolling primary, Forging valid secondary
//   Rod/Tube    → area      → Extrusion primary, Rolling secondary, Forging low
const RED_SCORES = {
    thickness: { rolling: 10, forging: 8, extrusion: 1 }, // forging CAN reduce thickness (flat-die)
    height: { rolling: 8, forging: 10, extrusion: 1 }, // same physics, forging-centric label
    area: { rolling: 3, forging: 2, extrusion: 10 } // extrusion primary for area reduction
};

// --- Material Compatibility Scores (can be negative = penalize) ---
const MAT_SCORES = {
    steel: { cold: { rolling: 1, forging: 2, extrusion: 0 }, warm: { rolling: 2, forging: 2, extrusion: 1 }, hot: { rolling: 2, forging: 3, extrusion: 2 } },
    aluminum: { cold: { rolling: 2, forging: 2, extrusion: 3 }, warm: { rolling: 2, forging: 2, extrusion: 3 }, hot: { rolling: 2, forging: 2, extrusion: 3 } },
    copper: { cold: { rolling: 2, forging: 1, extrusion: 3 }, warm: { rolling: 2, forging: 1, extrusion: 3 }, hot: { rolling: 2, forging: 1, extrusion: 3 } },
    titanium: { cold: { rolling: -1, forging: 2, extrusion: 1 }, warm: { rolling: 0, forging: 2, extrusion: 1 }, hot: { rolling: 1, forging: 2, extrusion: 1 } },
    brittle: { cold: { rolling: -3, forging: 2, extrusion: 0 }, warm: { rolling: -2, forging: 2, extrusion: 0 }, hot: { rolling: -1, forging: 2, extrusion: 0 } }
};

// --- Stage 1 Weights (updated: G=0.50, R=0.30, M=0.20) ---
const W_G = 0.50, W_R = 0.30, W_M = 0.20;

let shortlisted = [];
let stage1Scores = {};
let g_inp = '', g_out = ''; // track current input/output geo for Stage 2

// ============================================================
// STAGE 1: Feasibility Filtering
// ============================================================
function runStage1() {
    try {
        const inp = document.getElementById('inputGeo').value;
        const out = document.getElementById('outputGeo').value;
        g_inp = inp; g_out = out; // save for Stage 2 forging contact type
        const red = document.getElementById('redType').value;
        const d0 = parseFloat(document.getElementById('d0').value);
        const df = parseFloat(document.getElementById('df').value);
        const mat = document.getElementById('material').value;
        const temp = document.getElementById('tempCond').value;

        if (!d0 || !df || df >= d0 || d0 <= 0 || df <= 0) {
            alert('Enter valid dimensions: Initial > Final > 0');
            return;
        }

        const pctReduction = ((d0 - df) / d0) * 100;
        const geoS = getGeo(inp, out);
        const redS = RED_SCORES[red];
        const matS = MAT_SCORES[mat][temp];

        // Reduction bonus based on percentage
        const rb = { rolling: 0, forging: 0, extrusion: 0 };
        if (pctReduction < 15) rb.rolling += 2;
        else if (pctReduction <= 50) rb.forging += 2;
        else rb.extrusion += 2;

        // Temperature bonus
        const tb = { rolling: 0, forging: 0, extrusion: 0 };
        if (temp === 'hot') { tb.forging++; tb.extrusion++; }
        if (temp === 'cold') tb.rolling++;

        const procs = ['rolling', 'forging', 'extrusion'];
        const scores = {};

        procs.forEach(p => {
            const G = Math.max(0, geoS[p]);
            const R = Math.max(0, redS[p] + rb[p]);
            const M = matS[p] + tb[p];
            let S = W_G * G + W_R * R + W_M * Math.max(0, M);
            // Penalty if geometry score is very low
            if (G < 3) S *= 0.5;
            scores[p] = { G, R, M, S: +S.toFixed(2) };
        });
        stage1Scores = scores;

        const sorted = procs.slice().sort((a, b) => scores[b].S - scores[a].S);
        const topScore = scores[sorted[0]].S;

        // Dynamic Shortlisting:
        // Always include the best process. Include alternatives ONLY if they 
        // have a practically viable minimum score (>= 4.5) AND are statistically competitive 
        // compared to the top process (>= 60% of top score).
        shortlisted = sorted.filter(p => {
            if (p === sorted[0]) return true; // Best process always passes
            return scores[p].S >= 4.5 && scores[p].S >= topScore * 0.6;
        });

        if (shortlisted.length === 0) shortlisted = [sorted[0]];

        // Render reduction info
        const dimLabel = red === 'thickness' ? 't' : red === 'height' ? 'h' : 'd';
        document.getElementById('reductionInfo').innerHTML =
            `<div class="info-item">% Reduction: <strong>${pctReduction.toFixed(1)}%</strong></div>
       <div class="info-item">${dimLabel}₀: <strong>${d0} mm</strong></div>
       <div class="info-item">${dimLabel}_f: <strong>${df} mm</strong></div>
       <div class="info-item">Material: <strong>${mat} / ${temp}</strong></div>`;

        // Render score table
        let rows = '';
        sorted.forEach(p => {
            const sc = scores[p];
            const isShort = shortlisted.includes(p);
            rows += `<tr>
        <td><span class="process-tag tag-${p}">${p.toUpperCase()}</span></td>
        <td>${sc.G}/10</td><td>${sc.R}/10</td>
        <td>${sc.M > 0 ? '+' : ''}${sc.M}</td>
        <td style="font-family:'DM Mono',monospace;font-weight:500;color:${isShort ? 'var(--accent)' : 'var(--muted)'}">${sc.S}</td>
        <td>${isShort ? '<span class="badge badge-good">✔ Shortlisted</span>' : '<span class="badge badge-na">Eliminated</span>'}</td>
      </tr>`;
        });
        document.getElementById('s1tbody').innerHTML = rows;

        // Render score bars
        const colors = { rolling: 'var(--rolling)', forging: 'var(--accent2)', extrusion: 'var(--extrusion)' };
        const maxS = Math.max(...procs.map(p => scores[p].S));
        let bars = '';
        sorted.forEach(p => {
            const pct2 = (scores[p].S / (maxS || 1)) * 100;
            bars += `<div class="bar-row">
        <div class="bar-label">${p}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct2}%;background:${colors[p]}"></div></div>
        <div class="bar-val">${scores[p].S}</div>
      </div>
      <div class="bar-row" style="opacity:.5;padding-left:18px">
        <div class="bar-label" style="font-size:.6rem">G×${W_G}</div>
        <div class="bar-track" style="height:5px"><div class="bar-fill" style="width:${(scores[p].G / 10) * 100}%;background:${colors[p]}"></div></div>
        <div class="bar-val" style="font-size:.62rem">${scores[p].G}</div>
      </div>
      <div class="bar-row" style="opacity:.5;padding-left:18px;margin-bottom:.7rem">
        <div class="bar-label" style="font-size:.6rem">R×${W_R}</div>
        <div class="bar-track" style="height:5px"><div class="bar-fill" style="width:${(scores[p].R / 10) * 100}%;background:${colors[p]}80"></div></div>
        <div class="bar-val" style="font-size:.62rem">${scores[p].R}</div>
      </div>`;
        });
        document.getElementById('scoreBars').innerHTML = bars;

        // Shortlist display
        const sh = shortlisted.map(p => `<span class="process-tag tag-${p}" style="margin-right:.4rem;padding:.28rem .9rem;font-size:.82rem">${p.toUpperCase()}</span>`).join('');
        document.getElementById('shortlistContent').innerHTML =
            `<p style="font-size:.82rem;color:var(--muted);margin-bottom:.7rem">Proceeding to Stage 2 engineering analysis:</p>${sh}`;

        document.getElementById('s1results').classList.remove('hidden');
        document.getElementById('stage2section').classList.add('hidden');
        document.getElementById('s2results').classList.add('hidden');
        document.getElementById('finalDecision').classList.add('hidden');
        document.getElementById('s1results').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert('Error in Stage 1: ' + err.message);
    }
}

// ============================================================
// STAGE 2: Open Process-Specific Inputs
// Each process gets its OWN machine capacity + specific inputs
// ============================================================
function openStage2() {
    try {
        const d0 = parseFloat(document.getElementById('d0').value);
        const df = parseFloat(document.getElementById('df').value);
        const mat = document.getElementById('material').value;
        const temp = document.getElementById('tempCond').value;
        const { K, n } = MAT_DB[mat][temp];
        let html = '';

        shortlisted.forEach(p => {
            const col = p === 'rolling' ? 'var(--rolling)' : p === 'forging' ? 'var(--accent2)' : 'var(--extrusion)';
            const machineLabel = p === 'rolling' ? 'Rolling Mill Capacity' : p === 'forging' ? 'Forge Press Capacity' : 'Extrusion Press Capacity';

            html += `<div class="panel" style="border-color:${col}40">
        <div class="panel-title" style="color:${col};--accent:${col}">${p.toUpperCase()} — Process-Specific Inputs</div>
        <div style="margin-bottom:.8rem;font-size:.76rem;color:var(--muted)">Material: ${mat} (${temp}) → K = ${K} MPa, n = ${n}</div>`;

            // Each process has its own machine capacity
            html += `<div class="grid-3" style="margin-bottom:.9rem">
        <div class="field">
          <label>${machineLabel} <span class="unit">(kN)</span></label>
          <input type="number" id="${p}_Fm" placeholder="e.g. 5000" min="0">
        </div>
        <div class="field">
          <label>Friction Coefficient μ</label>
          <input type="number" id="${p}_mu" placeholder="${p === 'rolling' ? '0.05–0.3' : p === 'forging' ? '0.1–0.4' : '0.05–0.15'}" step="0.01" value="${p === 'rolling' ? '0.1' : p === 'forging' ? '0.2' : '0.08'}" min="0" max="0.5">
        </div>
        <div class="field">
          <label>Width / Contact Width b <span class="unit">(mm)</span></label>
          <input type="number" id="${p}_b" placeholder="e.g. 200" value="200" min="0">
        </div>
      </div>`;

            if (p === 'rolling') {
                html += `<div class="formula-box">
<b>Rolling Force:</b> F = σ_avg × b × L<br>
Contact Length: L = √[R × (t₀ − t_f)]<br>
Flow Stress: σ_avg = K × ε^n / (1+n) &nbsp;|&nbsp; ε = ln(t₀ / t_f)<br>
Draft Limit: Δh_max = μ² × R &nbsp;|&nbsp; Passes: N = ⌈(t₀ − t_f) / Δh_max⌉
</div>
        <div class="grid-3">
          <div class="field"><label>Initial Thickness t₀ <span class="unit">(mm)</span></label><input type="number" id="r_t0" value="${d0}" min="0"></div>
          <div class="field"><label>Final Thickness t_f <span class="unit">(mm)</span></label><input type="number" id="r_tf" value="${df}" min="0"></div>
          <div class="field"><label>Roll Radius R <span class="unit">(mm)</span></label><input type="number" id="r_R" placeholder="e.g. 300" min="0"></div>
        </div>`;
            }

            if (p === 'forging') {
                const fContact = getForgingContact(g_inp, g_out); // 'rect' or 'circ'
                if (fContact === 'rect') {
                    // Flat/sheet output — rectangular footprint, no diameter
                    html += `<div class="formula-box">
<b>Open-Die Forging — Flat Die (Rectangular Contact):</b><br>
F = K_f × σ_avg × A_contact &nbsp;|&nbsp; A = W_f × L_f<br>
Shape Factor: K_f = 1 + (0.4μ × W_f) / H_f<br>
Flow Stress: σ_avg = K × ε^n / (1+n) &nbsp;|&nbsp; ε = ln(h₀ / h_f)<br>
Passes: N = ⌈(h₀ − h_f) / (0.4 × h₀)⌉
</div>
        <div class="grid-3">
          <div class="field"><label>Initial Height h₀ <span class="unit">(mm)</span></label><input type="number" id="f_h0" value="${d0}" min="0"></div>
          <div class="field"><label>Final Height h_f <span class="unit">(mm)</span></label><input type="number" id="f_hf" value="${df}" min="0"></div>
          <div class="field"><label>Final Width W_f <span class="unit">(mm)</span></label><input type="number" id="f_W" placeholder="e.g. 300" min="0"></div>
        </div>
        <div class="grid-2" style="margin-top:.6rem">
          <div class="field"><label>Final Length L_f <span class="unit">(mm)</span></label><input type="number" id="f_L" placeholder="e.g. 400" min="0"></div>
          <div class="field" style="display:flex;align-items:flex-end;padding-bottom:.4rem">
            <span style="font-size:.73rem;color:var(--muted);font-family:'DM Mono',monospace">Contact area = W_f × L_f<br>K_f uses W_f as char. length</span>
          </div>
        </div>`;
                } else {
                    // Rod/disk output — circular footprint, use D_f
                    html += `<div class="formula-box">
<b>Open-Die Forging — Circular Cross-Section:</b><br>
F = K_f × σ_avg × A_contact &nbsp;|&nbsp; A = π × D_f² / 4<br>
Shape Factor: K_f = 1 + (0.4μ × D_f) / H_f<br>
Flow Stress: σ_avg = K × ε^n / (1+n) &nbsp;|&nbsp; ε = ln(h₀ / h_f)<br>
Passes: N = ⌈(h₀ − h_f) / (0.4 × h₀)⌉
</div>
        <div class="grid-3">
          <div class="field"><label>Initial Height h₀ <span class="unit">(mm)</span></label><input type="number" id="f_h0" value="${d0}" min="0"></div>
          <div class="field"><label>Final Height h_f <span class="unit">(mm)</span></label><input type="number" id="f_hf" value="${df}" min="0"></div>
          <div class="field"><label>Final Diameter D_f <span class="unit">(mm)</span></label><input type="number" id="f_D" placeholder="e.g. 80" min="0"></div>
        </div>`;
                }
                html += `<input type="hidden" id="f_contact" value="${fContact}">`;
            }

            if (p === 'extrusion') {
                const isTube = g_out === 'tube';
                const areaFormula = isTube ? 'A_f = π × (d_out² − d_in²) / 4' : 'A_f = π × d_f² / 4';

                html += `<div class="formula-box">
<b>Extrusion Force (${isTube ? 'Tubular' : 'Solid'}):</b> F = A₀ × p_ram<br>
Ram Pressure: p_ram = σ_avg × [a + b × ln(A₀/A_f)] &nbsp;(a=0.8, b=1.3)<br>
Flow Stress: σ_avg = K × ε^n / (1+n) &nbsp;|&nbsp; ε = ln(A₀ / A_f)<br>
Area: ${areaFormula} &nbsp;|&nbsp; Extrusion Ratio: ER = A₀ / A_f
</div>
        <div class="grid-3">
          <div class="field"><label>Initial Diameter d₀ <span class="unit">(mm)</span></label><input type="number" id="e_d0" value="${d0}" min="0"></div>
          <div class="field"><label>${isTube ? 'Outer Dia d_out' : 'Final Diameter d_f'} <span class="unit">(mm)</span></label><input type="number" id="e_df" value="${df}" min="0"></div>
          ${isTube ? `<div class="field"><label>Inner Dia d_in <span class="unit">(mm)</span></label><input type="number" id="e_df_inner" placeholder="e.g. 20" min="0"></div>` : `<div class="field"></div>`}
        </div>`;
            }
            html += '</div>';
        });

        document.getElementById('processInputsContainer').innerHTML = html;
        document.getElementById('stage2section').classList.remove('hidden');
        document.getElementById('stage2section').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert('Error opening Stage 2: ' + err.message);
    }
}
