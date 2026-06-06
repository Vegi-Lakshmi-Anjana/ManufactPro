# ManufactPro – Manufacturing Process Selection and Engineering Analysis Tool

ManufactPro is a web-based engineering decision support tool that assists in selecting suitable bulk metal forming processes based on geometry, material properties, reduction requirements, and manufacturing constraints.

The application evaluates candidate processes through a two-stage methodology that combines feasibility filtering with detailed engineering analysis. It supports **Rolling**, **Open-Die Forging**, and **Extrusion**, providing process recommendations based on force requirements, machine capacity, defect prediction, quality assessment, and cost estimation.

---

## Overview

Selecting an appropriate manufacturing process is a critical engineering decision that directly impacts product quality, production efficiency, manufacturing cost, and process feasibility.

ManufactPro streamlines this decision-making process by integrating engineering calculations with a structured process selection framework.

The tool follows a two-stage workflow:

### Stage 1 – Feasibility Filtering

Processes are evaluated using:

- Input and output geometry compatibility
- Reduction requirements
- Material characteristics
- Temperature conditions

### Stage 2 – Engineering Analysis

Shortlisted processes undergo detailed evaluation using process-specific engineering calculations, machine constraints, defect analysis, quality assessment, and cost estimation.

---

## Features

### Two-Stage Process Selection Framework

- Feasibility-based screening
- Weighted scoring methodology
- Dynamic process shortlisting
- Engineering-driven decision making

### Supported Manufacturing Processes

- Rolling
- Open-Die Forging
- Extrusion

### Material Database

Supports multiple engineering materials with temperature-dependent properties:

- Steel
- Aluminum
- Copper
- Titanium
- Brittle Materials

### Engineering Calculations

The tool performs calculations including:

- True Strain
- Average Flow Stress
- Rolling Force
- Forging Force
- Extrusion Force
- Contact Length
- Shape Factor
- Extrusion Ratio
- Machine Load Utilization

### Defect Prediction

Potential manufacturing defects are identified based on process conditions.

Examples include:

- Edge Cracking
- Surface Defects
- Work Hardening Risk
- Barreling
- Surface and Internal Cracks
- Central Burst
- Surface Tearing
- Die Failure Risk

### Quality Assessment

A Quality Index is generated using:

- Strain Levels
- Number of Passes
- Defect Severity
- Temperature Conditions

### Relative Cost Estimation

Manufacturing cost is estimated using:

- Forming Force
- Number of Passes
- Process Type
- Processing Temperature

### Final Recommendation Engine

The tool recommends the most suitable process using a weighted evaluation framework considering:

- Feasibility Score
- Force Requirements
- Machine Capacity
- Defect Severity
- Quality Assessment
- Cost Estimation

---

##  Methodology

### Stage 1 – Feasibility Filtering

Each process is scored using a weighted model:

| Criterion | Weight |
|------------|----------|
| Geometry Compatibility | 50% |
| Reduction Requirement | 30% |
| Material Compatibility | 20% |

Candidate processes are ranked and shortlisted for detailed evaluation.

---

### Stage 2 – Engineering Analysis

Each shortlisted process undergoes process-specific calculations.

#### Rolling Analysis

Calculates:

- True Strain
- Contact Length
- Draft Limit
- Rolling Force
- Number of Passes
- Machine Load Percentage

#### Open-Die Forging Analysis

Calculates:

- Forging Strain
- Contact Area
- Shape Factor
- Forging Force
- D/H Ratio
- Barreling Risk

#### Extrusion Analysis

Calculates:

- Extrusion Strain
- Extrusion Ratio
- Ram Pressure
- Extrusion Force
- Machine Load Percentage

---

##  Workflow

```text
User Inputs
      ↓
Stage 1 Feasibility Filtering
      ↓
Process Scoring
      ↓
Candidate Shortlisting
      ↓
Stage 2 Engineering Analysis
      ↓
Force & Defect Evaluation
      ↓
Quality and Cost Assessment
      ↓
Final Process Recommendation
```

---

## 🛠️ Technologies Used

| Technology | Purpose |
|------------|----------|
| HTML5 | Application Structure |
| CSS3 | User Interface Design |
| JavaScript | Engineering Calculations and Decision Logic |
| GitHub Pages | Deployment and Hosting |

---

## Project Structure

```text
ManufactPro/
│
├── index.html
├── style.css
├── script.js
└── README.md
```

---

##  Getting Started

### Clone the Repository

```bash
git clone <repository-url>
```

### Open the Application

Open:

```text
index.html
```

in any modern web browser.

No installation or external dependencies are required.

---

##  Engineering Concepts Applied

- Manufacturing Process Selection
- Bulk Metal Forming
- Plastic Deformation Theory
- True Strain Analysis
- Flow Stress Modelling
- Force Estimation
- Process Feasibility Analysis
- Defect Prediction
- Quality Assessment
- Cost Estimation
- Engineering Decision Support Systems
- Multi-Criteria Decision Making

---

##  Future Enhancements

- Additional Manufacturing Processes
- Expanded Material Database
- Process Comparison Dashboard
- Cost Modelling Enhancements
- Interactive Process Visualization
- Manufacturing Knowledge Base Integration

