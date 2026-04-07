export class HUD {
  constructor(onStateChange, onCultureChange) {
    this.onStateChange = onStateChange;
    this.onCultureChange = onCultureChange;
    this.contactHistory = [];
    this.blinkCount = 0;
    this.blinkWindow = [];
    this.lastBlinking = false;
    this._build();
  }

  _build() {
    const hud = document.getElementById('hud');

    // State buttons
    const stateRow = document.createElement('div');
    stateRow.className = 'hud-row';
    stateRow.innerHTML = '<span class="hud-label">State</span>';
    ['idle', 'listening', 'thinking', 'speaking'].forEach(s => {
      const btn = document.createElement('button');
      btn.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      btn.className = 'state-btn';
      btn.dataset.state = s;
      btn.onclick = () => {
        document.querySelectorAll('.state-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.onStateChange(s);
      };
      if (s === 'listening') btn.classList.add('active');
      stateRow.appendChild(btn);
    });
    hud.appendChild(stateRow);

    // Culture selector
    const cultureRow = document.createElement('div');
    cultureRow.className = 'hud-row';
    cultureRow.innerHTML = '<span class="hud-label">Culture</span>';
    const select = document.createElement('select');
    select.id = 'culture-select';
    [
      ['western', 'Western'],
      ['east_asian', 'East Asian'],
      ['middle_eastern', 'Middle Eastern'],
      ['south_asian', 'South Asian'],
    ].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      select.appendChild(opt);
    });
    select.onchange = () => this.onCultureChange(select.value);
    cultureRow.appendChild(select);
    hud.appendChild(cultureRow);

    // Telemetry
    this.telemetry = document.getElementById('telemetry');
  }

  update(smartOutput, gazeZone, webcamActive) {
    const now = performance.now();

    // Track contact percentage over 10s
    this.contactHistory.push({ t: now, looking: smartOutput.lookingAtUser });
    const cutoff = now - 10000;
    this.contactHistory = this.contactHistory.filter(e => e.t > cutoff);
    const contactPct = this.contactHistory.length > 0
      ? (this.contactHistory.filter(e => e.looking).length / this.contactHistory.length * 100).toFixed(0)
      : 0;

    // Track blink rate
    if (smartOutput.blinking && !this.lastBlinking) {
      this.blinkWindow.push(now);
    }
    this.lastBlinking = smartOutput.blinking;
    this.blinkWindow = this.blinkWindow.filter(t => t > now - 60000);
    const blinkRate = this.blinkWindow.length;

    const webcamDot = webcamActive ? '● active' : '○ simulated';
    const gazeDot = smartOutput.lookingAtUser ? '● looking' : '○ averted';

    this.telemetry.innerHTML = `
      <span class="tel-item">Webcam: <span class="${webcamActive ? 'green' : 'amber'}">${webcamDot}</span></span>
      <span class="tel-item">Gaze Zone: <span class="amber">${gazeZone}</span></span>
      <span class="tel-item">Avatar: <span class="${smartOutput.lookingAtUser ? 'green' : 'red'}">${gazeDot}</span></span>
      <span class="tel-item">Contact: <span class="amber">${contactPct}%</span></span>
      <span class="tel-item">Blinks: <span class="amber">${blinkRate}/min</span></span>
      <span class="tel-item">Pupil: <span class="amber">${smartOutput.pupilDiameter.toFixed(1)}mm</span></span>
    `;
  }
}
