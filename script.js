/* =========================================================
   1. UTILITY & LOCALSTORAGE HELPERS
   ========================================================= */

const Storage = {
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error(`Error reading ${key} from localStorage:`, error);
            return defaultValue;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            window.dispatchEvent(new Event("storage"));
        } catch (error) {
            console.error(`Error saving ${key} to localStorage:`, error);
        }
    },
    remove(key) {
        localStorage.removeItem(key);
        window.dispatchEvent(new Event("storage"));
    }
};

/* =========================================================
   2. INITIALIZE DATABASE
   ========================================================= */

function initDatabase() {
    if (!localStorage.getItem("users")) {
        Storage.set("users", {
            "student1": "password123",
            "student2": "password123",
            "admin": "admin123"
        });
    }

    if (!localStorage.getItem("serviceQueues")) {
        Storage.set("serviceQueues", {
            "Registrar": [],
            "Cashier": [],
            "Clinic": [],
            "Library": []
        });
    }

    if (!localStorage.getItem("activeServing")) {
        Storage.set("activeServing", {
            "Registrar": null,
            "Cashier": null,
            "Clinic": null,
            "Library": null
        });
    }

    if (!localStorage.getItem("missedTickets")) {
        Storage.set("missedTickets", {});
    }

    if (!localStorage.getItem("serviceDeadlines")) {
        Storage.set("serviceDeadlines", { "Registrar": null, "Cashier": null, "Clinic": null, "Library": null });
    }

    if (!localStorage.getItem("serviceStatuses")) {
        Storage.set("serviceStatuses", { "Registrar": "Open", "Cashier": "Open", "Clinic": "Open", "Library": "Open" });
    }
}

initDatabase();

let currentStudent = localStorage.getItem("loggedInUser") || "";
const NO_SHOW_TIMEOUT_MS = 5 * 60 * 1000;
let adminTimerInterval = null;

/* =========================================================
   3. AUDIO ALERT SYSTEM (WEB AUDIO API)
   ========================================================= */

function playCallSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc2.type = "sine";

        osc1.frequency.setValueAtTime(659.25, now);
        osc2.frequency.setValueAtTime(880.00, now + 0.15);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.15);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.6);
    } catch (e) {
        console.warn("Audio Context blocked or unsupported:", e);
    }
}

/* =========================================================
   4. VIEW ROUTER
   ========================================================= */

function showView(viewId) {
    const views = ["loginPage", "dashboard", "queuePage", "adminPage"];
    
    views.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === viewId) {
                element.style.display = (id === "loginPage" || id === "queuePage") ? "flex" : "block";
            } else {
                element.style.display = "none";
            }
        }
    });
}

/* =========================================================
   5. APP LIFECYCLE & EVENT BINDING
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();

    const activeService = localStorage.getItem("activeService");

    if (currentStudent) {
        const displayUser = document.getElementById("displayUsername");
        if (displayUser) displayUser.textContent = currentStudent;

        if (currentStudent === "admin") {
            showView("adminPage");
            renderAdminDashboard();
            startAdminTimer();
        } else if (activeService) {
            chooseService(activeService);
        } else {
            showView("dashboard");
            checkMissedStatus();
            updateServiceCards();
        }
    } else {
        showView("loginPage");
    }
});

function bindEvents() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const cancelBtn = document.getElementById("cancelQueueBtn");
    const resetPassword = document.getElementById("resetPassword");

    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    if (registerForm) registerForm.addEventListener("submit", handleRegister);
    if (cancelBtn) cancelBtn.addEventListener("click", cancelQueueTicket);
    if (resetPassword) {
        resetPassword.addEventListener("click", (e) => {
            e.preventDefault();
            alert("Demo Accounts: 'student1' / 'password123' and 'admin' / 'admin123'.");
        });
    }
}

function toggleAuthMode(event, mode) {
    if (event) event.preventDefault();

    const loginSec = document.getElementById("loginSection");
    const regSec = document.getElementById("registerSection");
    const loginErr = document.getElementById("loginError");
    const regMsg = document.getElementById("registerMessage");

    if (loginErr) loginErr.style.display = "none";
    if (regMsg) regMsg.style.display = "none";

    if (loginSec && regSec) {
        if (mode === "register") {
            loginSec.style.display = "none";
            regSec.style.display = "block";
        } else {
            regSec.style.display = "none";
            loginSec.style.display = "block";
        }
    }
}

/* =========================================================
   6. AUTHENTICATION & SESSION MANAGEMENT
   ========================================================= */

function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value.trim();
    const loginError = document.getElementById("loginError");

    const users = Storage.get("users", {});

    if (users[usernameInput] && users[usernameInput] === passwordInput) {
        currentStudent = usernameInput;
        localStorage.setItem("loggedInUser", currentStudent);

        const displayUser = document.getElementById("displayUsername");
        if (displayUser) displayUser.textContent = currentStudent;

        if (loginError) loginError.style.display = "none";

        if (currentStudent === "admin") {
            showView("adminPage");
            renderAdminDashboard();
            startAdminTimer();
        } else {
            showView("dashboard");
            checkMissedStatus();
            updateServiceCards();
        }
    } else {
        showStatusMessage(loginError, "Invalid username or password!", false);
    }
}

function handleRegister(event) {
    event.preventDefault();

    const usernameInput = document.getElementById("regUsername");
    const passwordInput = document.getElementById("regPassword");
    const regMsg = document.getElementById("registerMessage");

    const regUsername = usernameInput ? usernameInput.value.trim() : "";
    const regPassword = passwordInput ? passwordInput.value.trim() : "";

    if (!regUsername || !regPassword) {
        showStatusMessage(regMsg, "Please fill in all fields.", false);
        return;
    }

    const users = Storage.get("users", {});

    if (users[regUsername]) {
        showStatusMessage(regMsg, "Username already exists! Try another.", false);
        return;
    }

    users[regUsername] = regPassword;
    Storage.set("users", users);

    showStatusMessage(regMsg, "Account created! Switching to login...", true);

    document.getElementById("username").value = regUsername;
    document.getElementById("password").value = regPassword;

    usernameInput.value = "";
    passwordInput.value = "";

    setTimeout(() => toggleAuthMode(null, "login"), 1200);
}

function logout() {
    currentStudent = "";

    Storage.remove("loggedInUser");
    Storage.remove("activeService");
    stopAdminTimer();

    const loginError = document.getElementById("loginError");
    if (loginError) loginError.style.display = "none";

    showView("loginPage");
}

/* =========================================================
   7. STUDENT QUEUE LOGIC
   ========================================================= */

function checkMissedStatus() {
    const missedTickets = Storage.get("missedTickets", {});
    if (missedTickets[currentStudent]) {
        const missedService = missedTickets[currentStudent];
        delete missedTickets[currentStudent];
        Storage.set("missedTickets", missedTickets);

        alert(`⚠️ Attention: You missed your turn at the ${missedService} counter! Your ticket was cancelled. Please select the service again to get a new queue ticket.`);
    }
}

function chooseService(serviceName) {
    const serviceQueues = Storage.get("serviceQueues", {});
    const activeServing = Storage.get("activeServing", {});
    const serviceStatuses = Storage.get("serviceStatuses", {});

    if (serviceStatuses[serviceName] && serviceStatuses[serviceName] !== "Open") {
        alert(`${serviceName} is currently ${serviceStatuses[serviceName].toLowerCase()}. Please select another service or try again later.`);
        return;
    }

    if (!serviceQueues[serviceName]) {
        serviceQueues[serviceName] = [];
    }

    // Display state if user is currently at the counter
    if (activeServing[serviceName] === currentStudent) {
        document.getElementById("queueStudent").textContent = currentStudent;
        document.getElementById("queueService").textContent = serviceName;
        document.getElementById("queuePeople").textContent = "0 (SERVED)";
        document.getElementById("queueWaitTime").textContent = "0";
        document.getElementById("queueNumber").textContent = "NOW AT COUNTER";
        showView("queuePage");
        return;
    }

    const currentQueue = serviceQueues[serviceName];
    let userIndex = currentQueue.indexOf(currentStudent);

    if (userIndex === -1) {
        currentQueue.push(currentStudent);
        Storage.set("serviceQueues", serviceQueues);
        userIndex = currentQueue.length - 1;
    }

    localStorage.setItem("activeService", serviceName);

    const queueTicketNumber = userIndex + 1;
    const peopleAhead = userIndex;
    const estimatedWaitTime = Math.max(0, peopleAhead * 5);

    document.getElementById("queueStudent").textContent = currentStudent;
    document.getElementById("queueService").textContent = serviceName;
    document.getElementById("queuePeople").textContent = peopleAhead;
    document.getElementById("queueWaitTime").textContent = estimatedWaitTime;
    document.getElementById("queueNumber").textContent = String(queueTicketNumber).padStart(2, "0");

    showView("queuePage");
}

function cancelQueueTicket() {
    const activeService = localStorage.getItem("activeService");
    if (!activeService) return;

    if (confirm("Are you sure you want to leave the queue?")) {
        const serviceQueues = Storage.get("serviceQueues", {});
        if (serviceQueues[activeService]) {
            serviceQueues[activeService] = serviceQueues[activeService].filter(user => user !== currentStudent);
            Storage.set("serviceQueues", serviceQueues);
        }

        Storage.remove("activeService");
        showView("dashboard");
    }
}

function backToServices() {
    showView("dashboard");
    updateServiceCards();
}

function updateServiceCards() {
    const serviceQueues = Storage.get("serviceQueues", {});
    const serviceStatuses = Storage.get("serviceStatuses", {});

    Object.keys(serviceQueues).forEach(service => {
        const info = document.getElementById(`serviceInfo-${service}`);
        if (!info) return;

        const waitingCount = serviceQueues[service].length;
        const status = serviceStatuses[service] || "Open";
        info.textContent = status === "Open"
            ? `${waitingCount} ${waitingCount === 1 ? "student" : "students"} waiting`
            : `Currently ${status.toLowerCase()}`;
        info.className = `service-queue-info ${status === "Open" ? "is-open" : "is-unavailable"}`;
    });
}

/* =========================================================
   8. ADMIN PANEL WITH CLICKABLE QUEUE SELECTION
   ========================================================= */

function renderAdminDashboard() {
    const adminContainer = document.getElementById("adminQueueList");
    if (!adminContainer) return;

    const serviceQueues = Storage.get("serviceQueues", {});
    const activeServing = Storage.get("activeServing", {});
    const serviceDeadlines = Storage.get("serviceDeadlines", {});
    const serviceStatuses = Storage.get("serviceStatuses", {});
    adminContainer.innerHTML = "";

    Object.keys(serviceQueues).forEach(service => {
        const queue = serviceQueues[service];
        const currentlyServing = activeServing[service] || "None";
        const serviceStatus = serviceStatuses[service] || "Open";
        const remainingTime = getRemainingTime(serviceDeadlines[service]);
        const timerHtml = currentlyServing !== "None"
            ? `<p class="no-show-timer"><strong>No-show in:</strong> <span id="timer-${service}">${formatCountdown(remainingTime)}</span></p>`
            : "";

        // Build list HTML for people waiting in line
        let queueItemsHtml = "";
        if (queue.length > 0) {
            queue.forEach((student, idx) => {
                queueItemsHtml += `
                    <div class="queue-item" onclick="callSpecificStudent('${service}', '${student}')" title="Click to call ${student}">
                        <span><strong>#${idx + 1}</strong> - ${student}</span>
                        <span class="ticket-tag">Call Ticket &#10140;</span>
                    </div>
                `;
            });
        } else {
            queueItemsHtml = `<div class="empty-queue">No students waiting in line</div>`;
        }

        const card = document.createElement("div");
        card.className = "admin-service-card";
        card.innerHTML = `
            <h3>${service} Counter</h3>
            <p style="margin-bottom: 8px;"><strong>Now Serving:</strong> <span class="serving-badge">${currentlyServing}</span></p>
            ${timerHtml}
            <div class="service-status-control">
                <label for="status-${service}">Service status</label>
                <select id="status-${service}" onchange="updateServiceStatus('${service}', this.value)">
                    <option value="Open" ${serviceStatus === "Open" ? "selected" : ""}>Open</option>
                    <option value="Unavailable" ${serviceStatus === "Unavailable" ? "selected" : ""}>Unavailable</option>
                    <option value="Closed" ${serviceStatus === "Closed" ? "selected" : ""}>Closed</option>
                </select>
            </div>

            <div class="queue-list-box">
                <label>Waiting Queue (${queue.length}) - Click to call</label>
                <div class="queue-items">
                    ${queueItemsHtml}
                </div>
            </div>
            
            <div class="admin-actions">
                <button class="btn-serve" onclick="completeAndNext('${service}')" ${queue.length === 0 && currentlyServing === "None" ? "disabled" : ""}>
                    ${currentlyServing === "None" ? "Call First in Line" : "Complete & Call Next"}
                </button>
                <button class="btn-missed" onclick="markStudentMissed('${service}')" ${currentlyServing === "None" ? "disabled" : ""}>
                    Mark No-Show
                </button>
            </div>
        `;
        adminContainer.appendChild(card);
    });
}

function callSpecificStudent(serviceName, username) {
    const serviceQueues = Storage.get("serviceQueues", {});
    const activeServing = Storage.get("activeServing", {});

    // Remove selected student from waiting queue and place at counter
    if (serviceQueues[serviceName]) {
        serviceQueues[serviceName] = serviceQueues[serviceName].filter(user => user !== username);
        activeServing[serviceName] = username;

        Storage.set("serviceQueues", serviceQueues);
        Storage.set("activeServing", activeServing);
        startNoShowTimer(serviceName);

        playCallSound();
        renderAdminDashboard();
    }
}

function completeAndNext(serviceName) {
    const serviceQueues = Storage.get("serviceQueues", {});
    const activeServing = Storage.get("activeServing", {});

    if (serviceQueues[serviceName] && serviceQueues[serviceName].length > 0) {
        const nextUser = serviceQueues[serviceName].shift();
        activeServing[serviceName] = nextUser;
        
        Storage.set("serviceQueues", serviceQueues);
        Storage.set("activeServing", activeServing);
        startNoShowTimer(serviceName);
        
        playCallSound();
        renderAdminDashboard();
    } else {
        activeServing[serviceName] = "None";
        Storage.set("activeServing", activeServing);
        clearNoShowTimer(serviceName);
        renderAdminDashboard();
        alert(`Queue cleared for ${serviceName}.`);
    }
}

function markStudentMissed(serviceName) {
    const activeServing = Storage.get("activeServing", {});
    const missedUser = activeServing[serviceName];

    if (missedUser && missedUser !== "None") {
        const missedTickets = Storage.get("missedTickets", {});
        missedTickets[missedUser] = serviceName;
        Storage.set("missedTickets", missedTickets);

        activeServing[serviceName] = "None";
        Storage.set("activeServing", activeServing);
        clearNoShowTimer(serviceName);
        
        completeAndNext(serviceName);
    }
}

function updateServiceStatus(serviceName, status) {
    const serviceStatuses = Storage.get("serviceStatuses", {});
    serviceStatuses[serviceName] = status;
    Storage.set("serviceStatuses", serviceStatuses);
    renderAdminDashboard();
}

/* =========================================================
   9. ADMIN NO-SHOW COUNTDOWN
   ========================================================= */

function startNoShowTimer(serviceName) {
    const deadlines = Storage.get("serviceDeadlines", {});
    deadlines[serviceName] = Date.now() + NO_SHOW_TIMEOUT_MS;
    Storage.set("serviceDeadlines", deadlines);
}

function clearNoShowTimer(serviceName) {
    const deadlines = Storage.get("serviceDeadlines", {});
    deadlines[serviceName] = null;
    Storage.set("serviceDeadlines", deadlines);
}

function getRemainingTime(deadline) {
    return deadline ? Math.max(0, deadline - Date.now()) : 0;
}

function formatCountdown(remainingMs) {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function startAdminTimer() {
    stopAdminTimer();
    ensureTimersForStudentsAtCounters();
    adminTimerInterval = window.setInterval(updateAdminTimers, 1000);
    updateAdminTimers();
}

function ensureTimersForStudentsAtCounters() {
    const activeServing = Storage.get("activeServing", {});
    const deadlines = Storage.get("serviceDeadlines", {});
    let updated = false;

    Object.keys(activeServing).forEach(service => {
        if (activeServing[service] && activeServing[service] !== "None" && !deadlines[service]) {
            deadlines[service] = Date.now() + NO_SHOW_TIMEOUT_MS;
            updated = true;
        }
    });

    if (updated) Storage.set("serviceDeadlines", deadlines);
}

function stopAdminTimer() {
    if (adminTimerInterval) {
        window.clearInterval(adminTimerInterval);
        adminTimerInterval = null;
    }
}

function updateAdminTimers() {
    if (currentStudent !== "admin") return;

    const activeServing = Storage.get("activeServing", {});
    const deadlines = Storage.get("serviceDeadlines", {});
    const expiredService = Object.keys(activeServing).find(service =>
        activeServing[service] && activeServing[service] !== "None" &&
        deadlines[service] && getRemainingTime(deadlines[service]) === 0
    );

    if (expiredService) {
        markStudentMissed(expiredService);
        return;
    }

    Object.keys(activeServing).forEach(service => {
        const timerDisplay = document.getElementById(`timer-${service}`);
        if (timerDisplay && activeServing[service] && activeServing[service] !== "None") {
            timerDisplay.textContent = formatCountdown(getRemainingTime(deadlines[service]));
        }
    });
}

/* =========================================================
   10. REAL-TIME STORAGE & SYNC ENGINE
   ========================================================= */

window.addEventListener("storage", () => {
    const activeService = localStorage.getItem("activeService");

    if (currentStudent === "admin") {
        renderAdminDashboard();
        return;
    }

    if (document.getElementById("dashboard").style.display !== "none") {
        updateServiceCards();
    }

    if (activeService) {
        const activeServing = Storage.get("activeServing", {});
        const missedTickets = Storage.get("missedTickets", {});

        if (missedTickets[currentStudent]) {
            Storage.remove("activeService");
            showView("dashboard");
            checkMissedStatus();
            return;
        }

        if (activeServing[activeService] === currentStudent) {
            playCallSound();
            chooseService(activeService);
            return;
        }

        if (document.getElementById("queuePage").style.display !== "none") {
            chooseService(activeService);
        }
    }
});

/* =========================================================
   10. UTILITY HELPERS
   ========================================================= */

function showStatusMessage(element, message, isSuccess) {
    if (!element) return;
    element.textContent = message;
    element.style.color = isSuccess ? "#10b981" : "#ef4444";
    element.style.display = "block";
}
