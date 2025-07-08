class TimerApp {
    constructor() {
        // --- Timer State Properties ---
        this.timerState = 'idle'; // 'idle', 'running', 'paused', 'completed'
        this.initialTime = 25 * 60; // 初始總時間（秒），默認25分鐘
        this.currentTime = 25 * 60; // 當前時間（秒），倒數模式下為剩餘時間，正數模式下為已過時間
        this.mode = 'countdown'; // 'countdown' 或 'countup'
        this.reminders = []; // 提醒時間點: [{ id: unique, time: seconds, message: string, triggered: boolean }]
        this.customPresets = [ // Default custom presets
            { hours: 0, minutes: 5, seconds: 0, label: '5分鐘' },
            { hours: 0, minutes: 15, seconds: 0, label: '15分鐘' },
            { hours: 0, minutes: 25, seconds: 0, label: '25分鐘' },
            { hours: 0, minutes: 30, seconds: 0, label: '30分鐘' },
            { hours: 0, minutes: 45, seconds: 0, label: '45分鐘' },
            { hours: 1, minutes: 0, seconds: 0, label: '1小時' }
        ];
        this.soundEnabled = true;
        this.volume = 0.7; // 0.0 - 1.0
        this.selectedShortSound = 'chime'; // 短鈴聲 (提醒) - 使用檔案名稱
        this.selectedLongSound = 'phone_ring'; // 長鈴聲 (結束) - 使用檔案名稱
        this.intervalId = null; // setInterval 的 ID
        this.history = []; // 計時歷史記錄
        this.startTime = null; // 計時器開始或恢復時的時間戳
        this.elapsedTimeAtPause = 0; // 暫停時已過的時間（用於精確恢復）
        this.lastBeepSecond = -1; // 記錄上次響鈴的秒數，用於倒數最後10秒每秒提醒

        // --- Audio Context and Sounds ---
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // 將音效路徑改為相對路徑，因為檔案將和網頁一起託管在 GitHub Pages 上
        this.sounds = { 
            'chime': 'sounds/chime.mp3', 
            'ding': 'sounds/ding.mp3',   
            'notify': 'sounds/notify.mp3', 
            'bell': 'sounds/bell.mp3',     
            'gong': 'sounds/gong.mp3',     // 請確認您的鑼聲檔案名稱是否為 gong.mp3
            'phone_ring': 'sounds/phone_ring.mp3' 
        };
        this.audioBuffers = {}; // Store decoded audio buffers
        this.currentLongSoundSource = null; // To keep track of the playing long sound for stopping

        // --- DOM Elements ---
        this.elements = {
            timerDisplay: document.getElementById('timer-display'),
            currentStatus: document.getElementById('current-status'),
            progressCircle: document.getElementById('progress-circle'),
            startPauseBtn: document.getElementById('start-pause-btn'),
            resetBtn: document.getElementById('reset-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            quickPresetsContainer: document.getElementById('quick-presets-container'),
            currentModeDisplay: document.getElementById('current-mode-display'),
            soundStatusDisplay: document.getElementById('sound-status-display'),
            reminderCountDisplay: document.getElementById('reminder-count-display'),
            historyList: document.getElementById('history-list'),

            // Settings Modal
            settingsModal: document.getElementById('settings-modal'),
            closeSettingsBtn: document.getElementById('close-settings'),
            countdownModeBtn: document.getElementById('countdown-mode-btn'),
            countupModeBtn: document.getElementById('countup-mode-btn'),
            hoursInput: document.getElementById('hours-input'),
            minutesInput: document.getElementById('minutes-input'),
            secondsInput: document.getElementById('seconds-input'),
            customPresetsList: document.getElementById('custom-presets-list'),
            addCustomPresetBtn: document.getElementById('add-custom-preset-btn'),
            remindersList: document.getElementById('reminders-list'),
            addReminderBtn: document.getElementById('add-reminder-btn'),
            soundToggle: document.getElementById('sound-toggle'),
            volumeSlider: document.getElementById('volume-slider'),
            shortSoundSelect: document.getElementById('short-sound-select'),
            longSoundSelect: document.getElementById('long-sound-select'),
            testSoundBtn: document.getElementById('test-sound-btn'),
            applySettingsBtn: document.getElementById('apply-settings-btn'),

            // Code Modal
            showCodeBtn: document.getElementById('show-code-btn'),
            codeModal: document.getElementById('code-modal'),
            codeContent: document.getElementById('code-content'),
            copyCodeBtn: document.getElementById('copy-code-btn'),
            closeCodeModalBtn: document.getElementById('close-code-modal'),

            // History Section (Not a separate modal in this HTML structure, so will scroll to it)
            showHistoryModalBtn: document.getElementById('show-history-modal-btn'),
        };

        // --- Constants for Progress Circle ---
        this.CIRCLE_RADIUS = 54;
        this.CIRCLE_CIRCUMFERENCE = 2 * Math.PI * this.CIRCLE_RADIUS;
        this.elements.progressCircle.style.strokeDasharray = this.CIRCLE_CIRCUMFERENCE;

        // --- Bind Event Listeners ---
        this.addEventListeners();

        // --- Initialization ---
        this.loadPreferencesFromLocalStorage();
        this.loadSounds(); // Preload sounds
        this.updateTimerDisplay(); // Initial display
        this.updateControlButtons();
        this.updateStatusDisplay();
        this.renderCustomPresets(); // Render initial custom presets
        this.renderReminders(); // Render initial reminders

        // Set initial input values based on state for settings modal
        const { hours, minutes, seconds } = this.secondsToHMS(this.initialTime);
        this.elements.hoursInput.value = hours;
        this.elements.minutesInput.value = minutes;
        this.elements.secondsInput.value = seconds;

        this.elements.volumeSlider.value = this.volume * 100; // Set slider from 0-1 to 0-100
        this.elements.soundToggle.dataset.soundEnabled = this.soundEnabled;
        this.elements.soundToggle.querySelector('span').style.transform = this.soundEnabled ? 'translateX(1.5rem)' : 'translateX(0.25rem)';
        this.elements.shortSoundSelect.value = this.selectedShortSound;
        this.elements.longSoundSelect.value = this.selectedLongSound;

        // Initial history rendering (in case you add history directly to HTML)
        this.renderHistory();

        // Update document title for easy viewing
        document.title = `專業倒數計時器 - ${this.formatTime(this.currentTime)}`;
    }

    // --- Utility Functions ---
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        const pad = (num) => num.toString().padStart(2, '0');

        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    }

    secondsToHMS(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return { hours, minutes, seconds };
    }

    hmsToSeconds(h, m, s) {
        return (h * 3600) + (m * 60) + s;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${
            type === 'success' ? 'success' :
            type === 'error' ? 'error' :
            'info'
        }`;
        notification.textContent = message;

        this.elements.notificationArea = this.elements.notificationArea || document.getElementById('notification-area'); // Ensure it exists
        this.elements.notificationArea.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // --- Core Timer Logic ---
    startTimer() {
        if (this.timerState === 'running') return;

        if (this.timerState === 'idle' || this.timerState === 'completed') {
            // For countdown, start from initialTime
            // For countup, start from 0, initialTime is the target
            this.currentTime = this.mode === 'countdown' ? this.initialTime : 0;
            this.elapsedTimeAtPause = 0; // Reset for a new start
            this.reminders.forEach(r => r.triggered = false); // Reset reminders
            this.lastBeepSecond = -1; // Reset last beep
        }

        this.startTime = Date.now() - (this.elapsedTimeAtPause * 1000); // Adjust startTime for accurate elapsed time
        this.timerState = 'running';
        this.elements.currentStatus.textContent = '計時中';
        this.updateControlButtons();
        this.updateStatusDisplay();

        // Clear any existing interval to prevent multiple running timers
        if (this.intervalId) clearInterval(this.intervalId);

        this.intervalId = setInterval(() => this.timerLoop(), 1000);
        this.updateTimerDisplay(); // Initial update
        this.updateProgressCircle(); // Initial progress update
        this.showNotification('計時器已開始', 'info');
        document.title = `(RUN) ${this.formatTime(this.currentTime)}`;
    }

    pauseTimer() {
        if (this.timerState !== 'running') return;

        clearInterval(this.intervalId);
        this.intervalId = null;
        this.timerState = 'paused';
        this.elapsedTimeAtPause = (Date.now() - this.startTime) / 1000; // Store elapsed time at pause
        this.elements.currentStatus.textContent = '已暫停';
        this.updateControlButtons();
        this.showNotification('計時器已暫停', 'info');
        document.title = `(PAUSED) ${this.formatTime(this.currentTime)}`;
    }

    resetTimer() {
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.timerState = 'idle';
        this.currentTime = this.initialTime; // Reset to initial configured time
        this.elapsedTimeAtPause = 0;
        this.reminders.forEach(r => r.triggered = false); // Reset reminder triggered state
        this.lastBeepSecond = -1; // Reset last beep
        this.elements.currentStatus.textContent = '待機中';
        this.updateTimerDisplay();
        this.updateProgressCircle();
        this.updateControlButtons();
        this.showNotification('計時器已重置', 'info');
        document.title = `專業倒數計時器 - ${this.formatTime(this.currentTime)}`;
        this.stopAllSounds(); // Stop any playing sounds on reset
    }

    timerLoop() {
        let actualElapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        let displayTime;

        if (this.mode === 'countdown') {
            displayTime = this.initialTime - actualElapsedSeconds;
            if (displayTime <= 0) {
                this.currentTime = 0;
                this.updateTimerDisplay();
                this.updateProgressCircle(); // Ensure progress circle is full/empty
                this.timerComplete('completed');
                return;
            }
            this.currentTime = displayTime;
        } else { // countup
            displayTime = actualElapsedSeconds;
            this.currentTime = displayTime;
            // For countup, if initialTime is a target, call timerComplete when reached
            if (this.initialTime > 0 && this.currentTime >= this.initialTime) {
                this.currentTime = this.initialTime; // Cap at target
                this.updateTimerDisplay();
                this.updateProgressCircle();
                this.timerComplete('completed');
                return;
            }
        }

        this.updateTimerDisplay();
        this.updateProgressCircle();
        this.checkReminders();
        this.checkLastTenSecondsBeep();
        document.title = `(RUN) ${this.formatTime(this.currentTime)}`;
    }

    timerComplete(result) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.timerState = 'completed';
        this.elements.currentStatus.textContent = '已結束';
        this.updateControlButtons();
        this.addHistoryEntry(result); // Add to history
        this.showNotification('計時器已結束！', 'success');
        this.playSound('long'); // Play long sound for completion
        document.title = `計時器結束！`;
        this.stopAllSoundsAfterDelay(5000); // Stop long sound after a few seconds
    }

    // --- UI Update Methods ---
    updateTimerDisplay() {
        this.elements.timerDisplay.textContent = this.formatTime(this.currentTime);
    }

    updateProgressCircle() {
        let progress;
        if (this.initialTime <= 0) { // Avoid division by zero, especially for countup with no target
             progress = 0;
        } else if (this.mode === 'countdown') {
            progress = (this.initialTime - this.currentTime) / this.initialTime;
        } else { // countup
            progress = this.currentTime / this.initialTime;
            if (progress > 1) progress = 1; // Cap at 100% if countup exceeds target
        }

        const offset = this.CIRCLE_CIRCUMFERENCE - (progress * this.CIRCLE_CIRCUMFERENCE);
        this.elements.progressCircle.style.strokeDashoffset = offset;
    }

    updateControlButtons() {
        const { startPauseBtn, resetBtn, settingsBtn } = this.elements;

        startPauseBtn.classList.remove('running', 'paused', 'idle'); // Clear all state classes
        settingsBtn.disabled = false; // By default, settings are enabled

        if (this.timerState === 'running') {
            startPauseBtn.textContent = '暫停';
            startPauseBtn.classList.add('running');
            // In running state, disable settings changes to prevent mid-timer modifications
            settingsBtn.disabled = true;
            resetBtn.disabled = false;
        } else if (this.timerState === 'paused') {
            startPauseBtn.textContent = '繼續';
            startPauseBtn.classList.add('paused');
            resetBtn.disabled = false;
        } else if (this.timerState === 'idle') {
            startPauseBtn.textContent = '開始';
            resetBtn.disabled = true; // No need to reset if idle
            startPauseBtn.classList.add('idle'); // Apply base idle styling
        } else if (this.timerState === 'completed') {
            startPauseBtn.textContent = '重新開始';
            resetBtn.disabled = false;
            startPauseBtn.classList.add('idle'); // Use idle style for re-start
        }

        // Disable start button if initial time is 0 for countdown or if no time set at all
        if (this.mode === 'countdown' && this.initialTime === 0 && this.timerState === 'idle') {
            startPauseBtn.disabled = true;
            startPauseBtn.textContent = '設定時間';
        } else {
            // Re-enable if it was disabled due to 0 time and is now valid
            if(startPauseBtn.textContent === '設定時間' && this.initialTime > 0) {
                startPauseBtn.textContent = '開始';
            }
            startPauseBtn.disabled = false;
        }
    }

    updateStatusDisplay() {
        this.elements.currentModeDisplay.textContent = this.mode === 'countdown' ? '倒數計時' : '正數計時';
        this.elements.soundStatusDisplay.textContent = this.soundEnabled ? '開啟' : '關閉';
        this.elements.soundStatusDisplay.style.color = this.soundEnabled ? 'var(--color-green-600)' : 'var(--color-red-500)';
        this.elements.reminderCountDisplay.textContent = `${this.reminders.length}個`;
        this.elements.reminderCountDisplay.style.color = this.reminders.length > 0 ? 'var(--color-purple-600)' : 'var(--color-gray-500)';
    }

    // --- Settings Modal Logic ---
    openSettingsModal() {
        this.elements.settingsModal.classList.add('flex');
        // Populate current settings into the modal inputs
        const { hours, minutes, seconds } = this.secondsToHMS(this.initialTime);
        this.elements.hoursInput.value = hours;
        this.elements.minutesInput.value = minutes;
        this.elements.secondsInput.value = seconds;

        this.elements.countdownModeBtn.classList.toggle('active', this.mode === 'countdown');
        this.elements.countupModeBtn.classList.toggle('active', this.mode === 'countup');

        this.elements.soundToggle.dataset.soundEnabled = this.soundEnabled;
        this.elements.soundToggle.querySelector('span').style.transform = this.soundEnabled ? 'translateX(1.5rem)' : 'translateX(0.25rem)';
        this.elements.volumeSlider.value = this.volume * 100;
        this.elements.shortSoundSelect.value = this.selectedShortSound;
        this.elements.longSoundSelect.value = this.selectedLongSound;

        this.renderCustomPresets();
        this.renderReminders();
    }

    closeSettingsModal() {
        this.elements.settingsModal.classList.remove('flex');
    }

    saveSettings() {
        const newHours = parseInt(this.elements.hoursInput.value) || 0;
        const newMinutes = parseInt(this.elements.minutesInput.value) || 0;
        const newSeconds = parseInt(this.elements.secondsInput.value) || 0;

        const newTotalTime = this.hmsToSeconds(newHours, newMinutes, newSeconds);

        // Validate input
        if (this.mode === 'countdown' && newTotalTime <= 0) {
            this.showNotification('倒數計時模式下，總時間必須大於0！', 'error');
            return;
        }

        this.initialTime = newTotalTime;
        this.volume = parseFloat(this.elements.volumeSlider.value) / 100;
        this.soundEnabled = this.elements.soundToggle.dataset.soundEnabled === 'true';
        this.selectedShortSound = this.elements.shortSoundSelect.value;
        this.selectedLongSound = this.elements.longSoundSelect.value;

        // Reset triggered state for reminders on settings save
        this.reminders.forEach(r => r.triggered = false);

        this.setGlobalVolume(this.volume); // Apply new volume
        this.resetTimer(); // Reset timer to new settings
        this.savePreferencesToLocalStorage();
        this.updateStatusDisplay();
        this.closeSettingsModal();
        this.showNotification('設定已儲存並套用！', 'success');
    }

    toggleMode(selectedMode) {
        this.mode = selectedMode;
        this.elements.countdownModeBtn.classList.toggle('active', this.mode === 'countdown');
        this.elements.countupModeBtn.classList.toggle('active', this.mode === 'countup');

        // If switching to countdown and time is 0, suggest a default
        if (this.mode === 'countdown' && this.initialTime === 0) {
            this.initialTime = 25 * 60; // Default to 25 mins
            const { hours, minutes, seconds } = this.secondsToHMS(this.initialTime);
            this.elements.hoursInput.value = hours;
            this.elements.minutesInput.value = minutes;
            this.elements.secondsInput.value = seconds;
        }
        this.updateStatusDisplay();
    }

    renderCustomPresets() {
        this.elements.quickPresetsContainer.innerHTML = ''; // For main screen
        this.elements.customPresetsList.innerHTML = ''; // For settings modal

        if (this.customPresets.length === 0) {
            this.elements.quickPresetsContainer.innerHTML = '<p class="text-gray-500 text-sm">暫無自訂快速設定</p>';
            this.elements.customPresetsList.innerHTML = '<p class="text-gray-500 text-sm">暫無自訂快速設定</p>';
            return;
        }

        this.customPresets.forEach((preset, index) => {
            const presetSeconds = this.hmsToSeconds(preset.hours, preset.minutes, preset.seconds);
            const formattedTime = this.formatTime(presetSeconds);

            // Render for main screen quick presets
            const mainPresetBtn = document.createElement('button');
            mainPresetBtn.className = 'preset-btn';
            mainPresetBtn.textContent = preset.label || formattedTime;
            mainPresetBtn.dataset.hours = preset.hours;
            mainPresetBtn.dataset.minutes = preset.minutes;
            mainPresetBtn.dataset.seconds = preset.seconds;
            mainPresetBtn.addEventListener('click', () => {
                this.initialTime = presetSeconds;
                this.currentTime = presetSeconds;
                this.mode = 'countdown'; // Presets are typically for countdown
                this.resetTimer();
                this.updateStatusDisplay(); // Update current mode display
                this.showNotification(`已設定為 ${preset.label || formattedTime} (倒數計時)`, 'info');
            });
            this.elements.quickPresetsContainer.appendChild(mainPresetBtn);

            // Render for settings modal
            const customPresetItem = document.createElement('div');
            customPresetItem.className = 'custom-preset-item';
            customPresetItem.innerHTML = `
                <div class="input-group">
                    <input type="number" class="preset-hours" min="0" max="99" value="${preset.hours}">
                    <input type="number" class="preset-minutes" min="0" max="59" value="${preset.minutes}">
                    <input type="number" class="preset-seconds" min="0" max="59" value="${preset.seconds}">
                    <input type="text" class="preset-label" value="${preset.label}" placeholder="標籤 (例如: 25分鐘工作)">
                    <button class="remove-btn">×</button>
                </div>
            `;
            this.elements.customPresetsList.appendChild(customPresetItem);

            // Add event listeners for inputs and remove button in modal
            const hoursInput = customPresetItem.querySelector('.preset-hours');
            const minutesInput = customPresetItem.querySelector('.preset-minutes');
            const secondsInput = customPresetItem.querySelector('.preset-seconds');
            const labelInput = customPresetItem.querySelector('.preset-label');
            const removeBtn = customPresetItem.querySelector('.remove-btn');

            const updatePreset = () => {
                this.customPresets[index] = {
                    hours: parseInt(hoursInput.value) || 0,
                    minutes: parseInt(minutesInput.value) || 0,
                    seconds: parseInt(secondsInput.value) || 0,
                    label: labelInput.value.trim()
                };
                this.savePreferencesToLocalStorage();
                this.renderCustomPresets(); // Re-render to update quick presets on main screen
            };

            hoursInput.addEventListener('change', updatePreset);
            minutesInput.addEventListener('change', updatePreset);
            secondsInput.addEventListener('change', updatePreset);
            labelInput.addEventListener('change', updatePreset); // Use change to save when unfocused

            removeBtn.addEventListener('click', () => this.removeCustomPreset(index));
        });
    }

    addCustomPresetInput() {
        const newPreset = { hours: 0, minutes: 0, seconds: 0, label: '新設定' };
        this.customPresets.push(newPreset);
        this.savePreferencesToLocalStorage();
        this.renderCustomPresets();
    }

    removeCustomPreset(index) {
        if (confirm('確定要移除此自訂設定嗎？')) {
            this.customPresets.splice(index, 1);
            this.savePreferencesToLocalStorage();
            this.renderCustomPresets();
            this.showNotification('自訂設定已移除。', 'info');
        }
    }

    renderReminders() {
        this.elements.remindersList.innerHTML = '';
        this.reminders.sort((a, b) => a.time - b.time); // Sort by time ascending

        if (this.reminders.length === 0) {
            this.elements.remindersList.innerHTML = '<p class="text-gray-500 text-sm">暫無提醒設定</p>';
            this.updateStatusDisplay(); // Update reminder count
            return;
        }

        this.reminders.forEach((reminder, index) => {
            const { hours, minutes, seconds } = this.secondsToHMS(reminder.time);
            const reminderItem = document.createElement('div');
            reminderItem.className = 'reminder-item';
            reminderItem.innerHTML = `
                <div class="input-group">
                    <div>
                        <label class="input-label-xs">時</label>
                        <input type="number" class="reminder-hours" min="0" max="99" value="${hours}">
                    </div>
                    <div>
                        <label class="input-label-xs">分</label>
                        <input type="number" class="reminder-minutes" min="0" max="59" value="${minutes}">
                    </div>
                    <div>
                        <label class="input-label-xs">秒</label>
                        <input type="number" class="reminder-seconds" min="0" max="59" value="${seconds}">
                    </div>
                </div>
                <input type="text" class="reminder-message" placeholder="提醒訊息 (選填)" value="${reminder.message || ''}">
                <button class="remove-btn">×</button>
                <p class="info-text">在 ${this.formatTime(reminder.time)} 時提醒</p>
            `;
            this.elements.remindersList.appendChild(reminderItem);

            const hoursInput = reminderItem.querySelector('.reminder-hours');
            const minutesInput = reminderItem.querySelector('.reminder-minutes');
            const secondsInput = reminderItem.querySelector('.reminder-seconds');
            const messageInput = reminderItem.querySelector('.reminder-message');
            const removeBtn = reminderItem.querySelector('.remove-btn');

            const updateReminder = () => {
                const newTime = this.hmsToSeconds(
                    parseInt(hoursInput.value) || 0,
                    parseInt(minutesInput.value) || 0,
                    parseInt(secondsInput.value) || 0
                );
                // Ensure reminder time does not exceed current initialTime in countdown mode,
                // or doesn't go negative.
                if (newTime < 0) {
                    this.showNotification('提醒時間不能為負數！', 'error');
                    hoursInput.value = hours; // Revert
                    minutesInput.value = minutes;
                    secondsInput.value = seconds;
                    return;
                }
                if (this.mode === 'countdown' && newTime > this.initialTime) {
                    this.showNotification('提醒時間不能超過總時間！', 'error');
                    hoursInput.value = hours; // Revert
                    minutesInput.value = minutes;
                    secondsInput.value = seconds;
                    return;
                }

                this.reminders[index] = {
                    id: reminder.id, // Keep the same ID
                    time: newTime,
                    message: messageInput.value.trim(),
                    triggered: false // Reset triggered state when time is changed
                };
                this.savePreferencesToLocalStorage();
                this.renderReminders(); // Re-render to re-sort
            };

            hoursInput.addEventListener('change', updateReminder);
            minutesInput.addEventListener('change', updateReminder);
            secondsInput.addEventListener('change', updateReminder);
            messageInput.addEventListener('change', updateReminder);

            removeBtn.addEventListener('click', () => this.removeReminder(index));
        });
        this.updateStatusDisplay(); // Update reminder count
    }

    addReminderInput() {
        // Default new reminder time: for countdown, 0; for countup, 5 mins after current target or 5 mins
        const newReminderTime = this.mode === 'countdown' ? 0 : (this.initialTime > 0 ? this.initialTime + 300 : 300); 
        this.reminders.push({
            id: Date.now(), // Unique ID
            time: newReminderTime,
            message: '',
            triggered: false
        });
        this.savePreferencesToLocalStorage();
        this.renderReminders();
    }

    removeReminder(index) {
        if (confirm('確定要移除此提醒嗎？')) {
            this.reminders.splice(index, 1);
            this.savePreferencesToLocalStorage();
            this.renderReminders();
            this.showNotification('提醒已移除。', 'info');
        }
    }

    handleSoundToggle() {
        this.soundEnabled = !this.soundEnabled;
        this.elements.soundToggle.dataset.soundEnabled = this.soundEnabled;
        this.elements.soundToggle.querySelector('span').style.transform = this.soundEnabled ? 'translateX(1.5rem)' : 'translateX(0.25rem)';
        this.updateStatusDisplay();
        this.savePreferencesToLocalStorage();
        if (this.soundEnabled) {
            this.showNotification('音效已開啟。', 'success');
        } else {
            this.showNotification('音效已關閉。', 'info');
            this.stopAllSounds();
        }
    }

    testSound() {
        this.playSound('short');
        setTimeout(() => this.playSound('long'), 1000);
    }

    checkReminders() {
        // Using Math.round to handle potential floating point inaccuracies from Date.now() / 1000
        const currentSeconds = Math.round(this.currentTime);
        const totalSeconds = Math.round(this.initialTime);

        this.reminders.forEach(r => {
            let triggerCondition;
            if (this.mode === 'countdown') {
                // For countdown, reminder time is relative to the start (how much remaining)
                // So a reminder at 30s means "when 30 seconds remain".
                triggerCondition = currentSeconds === r.time;
            } else { // countup
                // For countup, reminder time is an elapsed time
                triggerCondition = currentSeconds === r.time;
            }

            if (triggerCondition && !r.triggered) {
                this.playSound('short');
                this.showNotification(`提醒：${r.message || '時間到了'}`, 'info');
                r.triggered = true; // Mark as triggered
            }
        });
    }

    // For countdown only: play a short beep for the last 10 seconds
    checkLastTenSecondsBeep() {
        if (this.mode === 'countdown' && this.currentTime <= 10 && this.currentTime > 0) {
            const currentSecondInteger = Math.floor(this.currentTime);
            if (currentSecondInteger !== this.lastBeepSecond) {
                this.playSound('short');
                this.lastBeepSecond = currentSecondInteger;
            }
        }
    }

    // --- Audio Management ---
    // This is crucial for web audio API to work, as AudioContext needs to be resumed
    // by a user gesture on some browsers (e.g., Chrome).
    ensureAudioContextResumed() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(e => console.error("Failed to resume AudioContext:", e));
        }
    }

    async loadSounds() {
        for (const key in this.sounds) {
            const url = this.sounds[key];
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.audioBuffers[key] = audioBuffer;
            } catch (e) {
                console.error(`Error loading or decoding audio for ${key} from ${url}:`, e);
                this.showNotification(`音效 "${key}" 載入失敗。請檢查檔案是否存在或路徑正確。`, 'error');
            }
        }
    }

    playSound(type) {
        if (!this.soundEnabled) return;

        this.ensureAudioContextResumed();

        const soundKey = type === 'short' ? this.selectedShortSound : this.selectedLongSound;
        const audioBuffer = this.audioBuffers[soundKey];

        if (audioBuffer) {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain(); // For volume control

            source.buffer = audioBuffer;
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            gainNode.gain.value = this.volume;
            source.start(0);

            // Store source to potentially stop it later (e.g. if new sound overlaps)
            if (type === 'long') {
                // Stop previous long sound if it's still playing
                if (this.currentLongSoundSource) {
                    try { this.currentLongSoundSource.stop(); } catch (e) { /* ignore error if already stopped */ }
                }
                this.currentLongSoundSource = source;
            }
        } else {
            console.warn(`Sound ${soundKey} not loaded or not found.`);
        }
    }

    setGlobalVolume(newVolume) {
        this.volume = newVolume;
    }

    // To stop long sounds after completion, for example
    stopAllSoundsAfterDelay(delayMs) {
        setTimeout(() => {
            this.stopAllSounds();
        }, delayMs);
    }

    stopAllSounds() {
        // Closing and recreating AudioContext is the most reliable way to stop all sounds
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().then(() => {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.audioBuffers = {}; // Clear old buffers
                this.loadSounds(); // Re-load sounds for new context
                this.currentLongSoundSource = null;
            }).catch(e => console.error("Error closing AudioContext:", e));
        }
    }

    // --- Local Storage Management ---
    savePreferencesToLocalStorage() {
        const preferences = {
            initialTime: this.initialTime,
            mode: this.mode,
            reminders: this.reminders.map(r => ({ time: r.time, message: r.message })), // Don't save 'triggered' state or ID
            customPresets: this.customPresets,
            soundEnabled: this.soundEnabled,
            volume: this.volume,
            selectedShortSound: this.selectedShortSound,
            selectedLongSound: this.selectedLongSound,
            history: this.history
        };
        localStorage.setItem('timerPreferences', JSON.stringify(preferences));
    }

    loadPreferencesFromLocalStorage() {
        const preferencesString = localStorage.getItem('timerPreferences');
        if (preferencesString) {
            const loadedPreferences = JSON.parse(preferencesString);
            // Safely assign loaded preferences, ensuring default values if properties are missing
            this.initialTime = loadedPreferences.initialTime !== undefined ? loadedPreferences.initialTime : this.initialTime;
            this.currentTime = this.initialTime; // Sync currentTime with loaded initialTime
            this.mode = loadedPreferences.mode || this.mode;
            this.reminders = (loadedPreferences.reminders || []).map(r => ({ ...r, id: Date.now() + Math.random(), triggered: false })); // Re-assign IDs and reset triggered
            this.customPresets = loadedPreferences.customPresets || this.customPresets;
            this.soundEnabled = loadedPreferences.soundEnabled !== undefined ? loadedPreferences.soundEnabled : this.soundEnabled;
            this.volume = loadedPreferences.volume !== undefined ? loadedPreferences.volume : this.volume;
            this.selectedShortSound = loadedPreferences.selectedShortSound || this.selectedShortSound;
            this.selectedLongSound = loadedPreferences.selectedLongSound || this.selectedLongSound;
            this.history = loadedPreferences.history || this.history;
        }
    }

    // --- History Management ---
    addHistoryEntry(result) {
        const entryTime = this.mode === 'countdown' ? this.initialTime : this.currentTime;
        this.history.push({
            type: this.mode,
            initialTime: this.initialTime, // Save the initial setting
            finalTime: this.currentTime, // For countup, this is the final elapsed; for countdown, it's 0
            result: result, // 'completed' or 'stopped'
            date: new Date().toLocaleString(),
            display: `${this.mode === 'countdown' ? '倒數' : '正數'}計時 ${this.formatTime(entryTime)} ${result === 'completed' ? '完成' : '停止'}`
        });
        this.savePreferencesToLocalStorage();
        this.renderHistory();
    }

    renderHistory() {
        this.elements.historyList.innerHTML = '';
        if (this.history.length === 0) {
            this.elements.historyList.innerHTML = '<p class="text-gray-500 text-sm">暫無計時記錄</p>';
            return;
        }
        this.history.slice().reverse().forEach(entry => { // Show most recent first
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-details">
                    <strong>${entry.type === 'countdown' ? '倒數' : '正數'}計時</strong> (${this.formatTime(entry.initialTime)}) - ${entry.result === 'completed' ? '完成' : '停止'}
                    ${entry.type === 'countup' ? `<br><span class="history-timestamp">實際計時: ${this.formatTime(entry.finalTime)}</span>` : ''}
                </div>
                <span class="history-timestamp">${entry.date}</span>
            `;
            this.elements.historyList.appendChild(div);
        });
    }

    openHistoryModal() {
        // 在 GitHub Pages 環境中，由於沒有單獨的歷史記錄模態框 HTML 元素，
        // 這裡會滾動到主頁面上的歷史記錄區塊並顯示通知。
        this.showNotification('歷史記錄顯示在下方區塊，滾動查看。', 'info');
        const historySection = document.querySelector('.history-section');
        if (historySection) {
            historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // 沒有單獨的 closeHistoryModal，因為歷史記錄在主頁面。如果未來添加，可在此處實現。
    closeHistoryModal() {
        // Placeholder, implement if you add a dedicated history modal
    }

    clearHistory() {
        if (confirm('確定要清除所有計時歷史記錄嗎？此操作不可恢復。')) {
            this.history = [];
            this.savePreferencesToLocalStorage();
            this.renderHistory();
            this.showNotification('計時歷史已清除。', 'success');
        }
    }

    // --- HTML Code Display Modal ---
    showCodeModal() {
        this.elements.codeModal.classList.add('flex');
        this.elements.codeContent.textContent = document.documentElement.outerHTML; // Get entire document HTML
    }

    copyCodeToClipboard() {
        const codeText = this.elements.codeContent.textContent;
        navigator.clipboard.writeText(codeText).then(() => {
            this.showNotification('HTML 程式碼已複製到剪貼簿！', 'success');
        }).catch(err => {
            this.showNotification('複製失敗: ' + err, 'error');
        });
    }

    // --- Event Listeners ---
    addEventListeners() {
        // Main Controls
        this.elements.startPauseBtn.addEventListener('click', () => {
            if (this.timerState === 'running') {
                this.pauseTimer();
            } else {
                this.startTimer();
            }
        });

        this.elements.resetBtn.addEventListener('click', () => {
            if (this.timerState === 'running' || this.timerState === 'paused') {
                this.addHistoryEntry('stopped'); // Only add to history if timer was actively running/paused
            }
            this.resetTimer();
        });

        this.elements.settingsBtn.addEventListener('click', () => this.openSettingsModal());

        // Settings Modal
        this.elements.closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
        this.elements.applySettingsBtn.addEventListener('click', () => this.saveSettings());

        this.elements.countdownModeBtn.addEventListener('click', () => this.toggleMode('countdown'));
        this.elements.countupModeBtn.addEventListener('click', () => this.toggleMode('countup'));

        // Time inputs should only trigger settings change on apply button click,
        // but we update the `initialTime` state immediately for preview/validation.
        this.elements.hoursInput.addEventListener('change', (e) => {
            this.initialTime = this.hmsToSeconds(parseInt(e.target.value) || 0, parseInt(this.elements.minutesInput.value) || 0, parseInt(this.elements.secondsInput.value) || 0);
            this.updateControlButtons(); // To potentially disable start button if time becomes 0 for countdown
        });
        this.elements.minutesInput.addEventListener('change', (e) => {
            this.initialTime = this.hmsToSeconds(parseInt(this.elements.hoursInput.value) || 0, parseInt(e.target.value) || 0, parseInt(this.elements.secondsInput.value) || 0);
            this.updateControlButtons();
        });
        this.elements.secondsInput.addEventListener('change', (e) => {
            this.initialTime = this.hmsToSeconds(parseInt(this.elements.hoursInput.value) || 0, parseInt(this.elements.minutesInput.value) || 0, parseInt(e.target.value) || 0);
            this.updateControlButtons();
        });

        this.elements.addCustomPresetBtn.addEventListener('click', () => this.addCustomPresetInput());
        this.elements.addReminderBtn.addEventListener('click', () => this.addReminderInput());

        this.elements.soundToggle.addEventListener('click', () => this.handleSoundToggle());
        this.elements.volumeSlider.addEventListener('input', (e) => this.setGlobalVolume(parseFloat(e.target.value) / 100));
        this.elements.shortSoundSelect.addEventListener('change', (e) => { this.selectedShortSound = e.target.value; this.playSound('short'); this.savePreferencesToLocalStorage(); });
        this.elements.longSoundSelect.addEventListener('change', (e) => { this.selectedLongSound = e.target.value; this.playSound('long'); this.savePreferencesToLocalStorage(); });
        this.elements.testSoundBtn.addEventListener('click', () => this.testSound());

        // Code Modal
        this.elements.showCodeBtn.addEventListener('click', () => this.showCodeModal());
        this.elements.copyCodeBtn.addEventListener('click', () => this.copyCodeToClipboard());
        this.elements.closeCodeModalBtn.addEventListener('click', () => this.elements.codeModal.classList.remove('flex'));

        // History (using existing section)
        this.elements.showHistoryModalBtn.addEventListener('click', () => this.openHistoryModal());
        // For demonstration, I'll add a clear history button to the main history section.
        const clearHistoryButton = document.createElement('button');
        clearHistoryButton.textContent = '清除所有記錄';
        clearHistoryButton.className = 'btn bg-red-500 text-white hover:bg-red-600 mt-4';
        clearHistoryButton.style.display = 'block'; // Ensure it's a block element
        clearHistoryButton.style.width = '100%';
        clearHistoryButton.style.borderRadius = 'var(--radius-lg)';
        clearHistoryButton.addEventListener('click', () => this.clearHistory());
        // 確保元素存在後再添加，避免潛在錯誤
        const historySectionDiv = document.querySelector('.history-section');
        if (historySectionDiv) {
            historySectionDiv.appendChild(clearHistoryButton);
        }

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Prevent default spacebar action (scrolling)
            if (e.code === 'Space' && !e.target.closest('input, select, textarea, button')) {
                e.preventDefault();
                // Only trigger if no modal is open
                if (!this.elements.settingsModal.classList.contains('flex') && !this.elements.codeModal.classList.contains('flex')) {
                    if (this.timerState === 'running') {
                        this.pauseTimer();
                    } else if (this.timerState === 'paused' || this.timerState === 'idle' || this.timerState === 'completed') {
                        this.startTimer();
                    }
                }
            } else if ((e.key === 'r' || e.key === 'R') && !e.target.closest('input, select, textarea')) {
                if (!this.elements.settingsModal.classList.contains('flex') && !this.elements.codeModal.classList.contains('flex')) {
                    this.elements.resetBtn.click();
                }
            } else if ((e.key === 's' || e.key === 'S') && !e.target.closest('input, select, textarea')) {
                if (!this.elements.settingsModal.classList.contains('flex') && !this.elements.codeModal.classList.contains('flex')) {
                    this.elements.settingsBtn.click();
                }
            }
        });

        // Audio Context resume on first user interaction
        // This helps bypass browser auto-play policies
        document.addEventListener('click', () => this.ensureAudioContextResumed(), { once: true });
        document.addEventListener('keydown', () => this.ensureAudioContextResumed(), { once: true });
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new TimerApp();
});