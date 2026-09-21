// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';

// ECOSYSTEM-FEAT-003: Quality Status Panel.
// Renders the same `zenzic score --json` payload already parsed by
// zenzic.computeDQS (extension.ts) as three progress rows: Quality Score,
// Suppression Cap Usage, and Baseline Freshness. No new subprocess call is
// introduced here — the panel is driven entirely by the report object the
// caller already fetched via the existing bridge.
//
// Labels are deliberately governance/quality framing, never "credits",
// "budget", or "quota" — this is not a consumption metric. Presentation is
// informative, not gamified: plain progress bars, no celebratory animation
// on score improvement, VS Code native theme tokens only (no fixed
// dark/glass aesthetic).

export interface QualityPanelReport {
    score: number;
    status: string;
    suppression_count?: number;
    suppression_cap?: number;
    suppression_debt_pts?: number;
    debt_status?: string;
    baseline_status?: 'fresh' | 'stale' | 'absent';
    baseline_age_days?: number | null;
    categories?: Array<{ name: string; issues: number }>;
}

let panel: vscode.WebviewPanel | undefined;

export function showQualityPanel(
    context: vscode.ExtensionContext,
    report: QualityPanelReport | undefined,
    onRefresh: () => Promise<void>
): void {
    if (panel) {
        panel.reveal(vscode.ViewColumn.Beside);
        if (report) {
            panel.webview.postMessage({ type: 'update', report });
        }
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'zenzicQualityPanel',
        'Zenzic Quality Status',
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = renderHtml();

    panel.webview.onDidReceiveMessage(async (message: { type?: string }) => {
        if (message?.type === 'refresh') {
            await onRefresh();
        }
    });

    panel.onDidDispose(() => {
        panel = undefined;
    });

    context.subscriptions.push(panel);

    if (report) {
        panel.webview.postMessage({ type: 'update', report });
    }
}

export function updateQualityPanel(report: QualityPanelReport): void {
    panel?.webview.postMessage({ type: 'update', report });
}

function renderHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    padding: 16px 20px;
  }
  h2 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 16px 0;
  }
  .row {
    margin-bottom: 18px;
  }
  .row-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .row-label {
    font-size: 13px;
    font-weight: 500;
  }
  .row-value {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--vscode-descriptionForeground);
  }
  .bar-track {
    height: 6px;
    border-radius: 3px;
    background-color: var(--vscode-progressBar-background, var(--vscode-editorWidget-border));
    opacity: 0.3;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 3px;
    background-color: var(--vscode-charts-blue, var(--vscode-progressBar-background));
    transition: width 0.2s ease;
  }
  .bar-fill.warn { background-color: var(--vscode-charts-yellow, #cca700); }
  .bar-fill.error { background-color: var(--vscode-charts-red, #f14c4c); }
  .status-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--vscode-charts-green, #3fb950);
    flex-shrink: 0;
  }
  .dot.stale { background-color: var(--vscode-charts-yellow, #cca700); }
  .dot.absent { background-color: var(--vscode-descriptionForeground); }
  .empty-state {
    color: var(--vscode-descriptionForeground);
    font-size: 13px;
  }
  button {
    margin-top: 8px;
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 4px 10px;
    border-radius: 2px;
    font-size: 12px;
    cursor: pointer;
  }
  button:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }
</style>
</head>
<body>
  <h2>Zenzic Quality Status</h2>
  <div id="content">
    <div class="empty-state">No data yet — click Refresh to compute.</div>
  </div>
  <button id="refresh">Refresh</button>

<script>
  const vscode = acquireVsCodeApi();
  const content = document.getElementById('content');
  document.getElementById('refresh').addEventListener('click', () => {
    vscode.postMessage({ type: 'refresh' });
  });

  function barClass(fraction) {
    if (fraction >= 0.9) return 'error';
    if (fraction >= 0.7) return 'warn';
    return '';
  }

  function render(report) {
    const score = report.score ?? 0;
    const scoreFraction = Math.min(1, Math.max(0, score / 100));
    const scoreBarClass = score >= 80 ? '' : score >= 50 ? 'warn' : 'error';

    const suppCount = report.suppression_count ?? 0;
    const suppCap = report.suppression_cap ?? 30;
    const suppFraction = suppCap > 0 ? Math.min(1, suppCount / suppCap) : 0;

    const baselineStatus = report.baseline_status ?? 'absent';
    const baselineAge = report.baseline_age_days;
    let baselineText;
    if (baselineStatus === 'absent') {
      baselineText = 'No saved snapshot — run "zenzic score --save" to establish one.';
    } else if (baselineAge != null) {
      const ageLabel = baselineAge < 1
        ? 'less than a day old'
        : \`\${Math.round(baselineAge)} day\${Math.round(baselineAge) === 1 ? '' : 's'} old\`;
      baselineText = baselineStatus === 'stale'
        ? \`Stale — snapshot is \${ageLabel}\`
        : \`Fresh — snapshot is \${ageLabel}\`;
    } else {
      baselineText = baselineStatus;
    }

    content.innerHTML = \`
      <div class="row">
        <div class="row-header">
          <span class="row-label">Quality Score</span>
          <span class="row-value">\${score}/100</span>
        </div>
        <div class="bar-track"><div class="bar-fill \${scoreBarClass}" style="width:\${scoreFraction * 100}%"></div></div>
      </div>
      <div class="row">
        <div class="row-header">
          <span class="row-label">Suppression Cap Usage</span>
          <span class="row-value">\${suppCount}/\${suppCap}</span>
        </div>
        <div class="bar-track"><div class="bar-fill \${barClass(suppFraction)}" style="width:\${suppFraction * 100}%"></div></div>
      </div>
      <div class="row">
        <div class="row-header">
          <span class="row-label">Baseline Freshness</span>
        </div>
        <div class="status-line">
          <span class="dot \${baselineStatus}"></span>
          <span>\${baselineText}</span>
        </div>
      </div>
    \`;
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'update') {
      render(message.report);
    }
  });
</script>
</body>
</html>`;
}
