/* =========================================================
   1. APP DATA & LOCAL STORAGE HELPERS
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

const SERVICES = ["Registrar", "Cashier", "Clinic", "Library"];
const SERVICE_STATUS = {
    OPEN: "Open",
    UNAVAILABLE: "Unavailable",
    CLOSED: "Closed"
};
const NO_SHOW_TIMEOUT_MS = 5 * 60 * 1000;

function createServiceMap(defaultValue) {
    return Object.fromEntries(SERVICES.map(service => [service, defaultValue]));
}

/* =========================================================
   2. INITIAL APP DATA: users, queues, services, and notifications
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
        Storage.set("serviceQueues", createServiceMap([]));
    }

    if (!localStorage.getItem("activeServing")) {
        Storage.set("activeServing", createServiceMap(null));
    }

    if (!localStorage.getItem("missedTickets")) {
        Storage.set("missedTickets", {});
    }

    if (!localStorage.getItem("serviceDeadlines")) {
        Storage.set("serviceDeadlines", createServiceMap(null));
    }

    if (!localStorage.getItem("serviceStatuses")) {
        Storage.set("serviceStatuses", createServiceMap(SERVICE_STATUS.OPEN));
    }

    if (!localStorage.getItem("queueNotifications")) {
        Storage.set("queueNotifications", []);
    }

    if (!localStorage.getItem("serviceArrivals")) {
        Storage.set("serviceArrivals", createServiceMap(false));
    }
}

initDatabase();

// Sessions are per browser tab. A ticket is stored per user so it survives a
// logout and is not overwritten by another person using the same browser.
let currentStudent = sessionStorage.getItem("loggedInUser") || "";
let adminTimerInterval = null;
let lastTurnAlert = "";

function activeServiceKey(username = currentStudent) {
    return username ? `activeService:${username}` : "";
}

function getActiveService() {
    return currentStudent ? localStorage.getItem(activeServiceKey()) : null;
}

function setActiveService(serviceName) {
    if (currentStudent) localStorage.setItem(activeServiceKey(), serviceName);
}

function clearActiveService() {
    if (currentStudent) Storage.remove(activeServiceKey());
}

/* =========================================================
   3. AUDIO ALERT SYSTEM: sound played when a ticket is called
   ========================================================= */

function playCallSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc2.type = "sine";

        // A cheerful "boop-boop-ta-da" rather than a harsh alarm.
        osc1.frequency.setValueAtTime(523.25, now);
        osc2.frequency.setValueAtTime(659.25, now + 0.18);
        osc3.frequency.setValueAtTime(783.99, now + 0.36);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc1.connect(gain);
        osc2.connect(gain);
        osc3.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.16);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.34);
        osc3.start(now + 0.36);
        osc3.stop(now + 0.8);
        osc3.addEventListener("ended", () => ctx.close().catch(() => {}));
    } catch (e) {
        console.warn("Audio Context blocked or unsupported:", e);
    }
}

function requestTurnNotifications() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
    }
}

function notifyTurnCalled(serviceName) {
    const alertKey = `${currentStudent}:${serviceName}`;
    if (lastTurnAlert === alertKey) return;

    lastTurnAlert = alertKey;
    playCallSound();
    showTurnAlert(`🎉 Ding-dong! It is your turn at ${serviceName}. Please head to the counter.`);

    if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification("It is your turn", {
            body: `Please proceed to the ${serviceName} counter.`,
            tag: `campus-queue-${serviceName}`
        });
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}

function showTurnAlert(message) {
    const alertBox = document.getElementById("turnAlert");
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.classList.add("is-visible");
    window.setTimeout(() => alertBox.classList.remove("is-visible"), 7000);
}

/* =========================================================
   4. SCREEN ROUTER: shows the current login, student, or admin screen
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
   5. APP STARTUP & BUTTON EVENT BINDING
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();

    const activeService = getActiveService();

    if (currentStudent) {
        const displayUser = document.getElementById("displayUsername");
        if (displayUser) displayUser.textContent = currentStudent;

        if (currentStudent === "admin") {
            showView("adminPage");
            renderAdminDashboard();
            startAdminTimer();
        } else {
            checkMissedStatus();
            const savedService = getActiveService();
            if (savedService) {
                chooseService(savedService);
            } else {
                showView("dashboard");
                updateServiceCards();
                updatePendingQueueCard();
            }
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
   6. LOGIN, REGISTRATION & SESSION MANAGEMENT
   ========================================================= */

function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value.trim();
    const loginError = document.getElementById("loginError");

    const users = Storage.get("users", {});

    if (users[usernameInput] && users[usernameInput] === passwordInput) {
        currentStudent = usernameInput;
        sessionStorage.setItem("loggedInUser", currentStudent);
        requestTurnNotifications();

        const displayUser = document.getElementById("displayUsername");
        if (displayUser) displayUser.textContent = currentStudent;

        if (loginError) loginError.style.display = "none";

        if (currentStudent === "admin") {
            showView("adminPage");
            renderAdminDashboard();
            startAdminTimer();
        } else {
            checkMissedStatus();
            const savedService = getActiveService();
            if (savedService) {
                chooseService(savedService);
            } else {
                showView("dashboard");
                updateServiceCards();
                updatePendingQueueCard();
            }
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

    sessionStorage.removeItem("loggedInUser");
    stopAdminTimer();

    const loginError = document.getElementById("loginError");
    if (loginError) loginError.style.display = "none";

    document.getElementById("loginForm")?.reset();
    document.getElementById("registerForm")?.reset();
    toggleAuthMode(null, "login");
    lastTurnAlert = "";
    showView("loginPage");
}

/* =========================================================
   7. STUDENT QUEUE LOGIC: join, view, leave, and track a ticket
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
    const savedService = getActiveService();

    if (savedService && savedService !== serviceName) {
        const savedQueue = serviceQueues[savedService] || [];
        const isAlreadyServing = activeServing[savedService] === currentStudent;
        if (savedQueue.includes(currentStudent) || isAlreadyServing) {
            alert(`You already have an active ticket for ${savedService}. Please leave or finish that queue before joining another one.`);
            return;
        }
        clearActiveService();
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
        const cancelBtn = document.getElementById("cancelQueueBtn");
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.textContent = "At Counter";
        }
        showView("queuePage");
        return;
    }

    const currentQueue = serviceQueues[serviceName];
    let userIndex = currentQueue.indexOf(currentStudent);

    if (userIndex === -1) {
    if (serviceStatuses[serviceName] && serviceStatuses[serviceName] !== SERVICE_STATUS.OPEN) {
            alert(`${serviceName} is currently ${serviceStatuses[serviceName].toLowerCase()}. Please select another service or try again later.`);
            return;
        }

        currentQueue.push(currentStudent);
        Storage.set("serviceQueues", serviceQueues);
        requestTurnNotifications();
        userIndex = currentQueue.length - 1;
        addQueueNotification(currentStudent, serviceName);
    }

    setActiveService(serviceName);

    const queueTicketNumber = userIndex + 1;
    const peopleAhead = userIndex;
    const estimatedWaitTime = Math.max(0, peopleAhead * 5);

    document.getElementById("queueStudent").textContent = currentStudent;
    document.getElementById("queueService").textContent = serviceName;
    document.getElementById("queuePeople").textContent = peopleAhead;
    document.getElementById("queueWaitTime").textContent = estimatedWaitTime;
    document.getElementById("queueNumber").textContent = String(queueTicketNumber).padStart(2, "0");
    const cancelBtn = document.getElementById("cancelQueueBtn");
    if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.textContent = "Leave Queue";
    }

    showView("queuePage");
}

function cancelQueueTicket() {
    const activeService = getActiveService();
    if (!activeService) return;

    if (confirm("Are you sure you want to leave the queue?")) {
        const serviceQueues = Storage.get("serviceQueues", {});
        if (serviceQueues[activeService]) {
            serviceQueues[activeService] = serviceQueues[activeService].filter(user => user !== currentStudent);
            Storage.set("serviceQueues", serviceQueues);
        }

        clearActiveService();
        showView("dashboard");
        updateServiceCards();
        updatePendingQueueCard();
    }
}

function backToServices() {
    showView("dashboard");
    updateServiceCards();
    updatePendingQueueCard();
}

function updateServiceCards() {
    const serviceQueues = Storage.get("serviceQueues", {});
    const serviceStatuses = Storage.get("serviceStatuses", {});

    Object.keys(serviceQueues).forEach(service => {
        const info = document.getElementById(`serviceInfo-${service}`);
        if (!info) return;

        const waitingCount = serviceQueues[service].length;
        const status = serviceStatuses[service] || "Open";
        info.textContent = status === SERVICE_STATUS.OPEN
            ? `${waitingCount} ${waitingCount === 1 ? "student" : "students"} waiting`
            : `Currently ${status.toLowerCase()}`;
        info.className = `service-queue-info ${status === SERVICE_STATUS.OPEN ? "is-open" : "is-unavailable"}`;
    });
}

function updatePendingQueueCard() {
    const pendingCard = document.getElementById("pendingQueueCard");
    const activeService = getActiveService();
    if (!pendingCard || !activeService) {
        if (pendingCard) pendingCard.style.display = "none";
        return;
    }

    const serviceQueues = Storage.get("serviceQueues", {});
    const activeServing = Storage.get("activeServing", {});
    const queue = serviceQueues[activeService] || [];
    const position = queue.indexOf(currentStudent);
    const isServing = activeServing[activeService] === currentStudent;

    if (position === -1 && !isServing) {
        pendingCard.style.display = "none";
        return;
    }

    document.getElementById("pendingQueueService").textContent = activeService;
    document.getElementById("pendingQueueDetails").textContent = isServing
        ? "You are now being served at the counter."
        : `Position #${position + 1} · ${position} ${position === 1 ? "student" : "students"} ahead`;
    pendingCard.style.display = "flex";
}

function viewPendingTicket() {
    const activeService = getActiveService();
    if (activeService) chooseService(activeService);
}

function addQueueNotification(username, serviceName) {
    const notifications = Storage.get("queueNotifications", []);
    notifications.unshift({ username, serviceName, createdAt: Date.now() });
    Storage.set("queueNotifications", notifications.slice(0, 5));
}

/* =========================================================
   8. ADMIN QUEUE PANEL: call tickets, manage service status, and arrivals
   ========================================================= */

function renderAdminDashboard() {
    const adminContainer = document.getElementById("adminQueueList");
    if (!adminContainer) return;

    const serviceQueues = Storage.get("serviceQueues", {});
    const activeServing = Storage.get("activeServing", {});
    const serviceDeadlines = Storage.get("serviceDeadlines", {});
    const serviceStatuses = Storage.get("serviceStatuses", {});
    const serviceArrivals = Storage.get("serviceArrivals", {});
    renderAdminNotifications();
    adminContainer.innerHTML = "";

    Object.keys(serviceQueues).forEach(service => {
        const queue = serviceQueues[service];
        const currentlyServing = activeServing[service] || "None";
        const serviceStatus = serviceStatuses[service] || SERVICE_STATUS.OPEN;
        const hasArrived = serviceArrivals[service] === true;
        const remainingTime = getRemainingTime(serviceDeadlines[service]);
        const timerHtml = currentlyServing !== "None"
            ? hasArrived
                ? `<p class="arrival-confirmed">Ticket arrived</p>`
                : `<p class="no-show-timer"><strong>No-show in:</strong> <span id="timer-${service}">${formatCountdown(remainingTime)}</span></p>`
            : "";

        const queueItemsHtml = queue.length === 0
            ? `<div class="empty-queue">No students waiting in line</div>`
            : "";

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
                <button class="btn-missed" onclick="markStudentMissed('${service}')" ${currentlyServing === "None" || hasArrived ? "disabled" : ""}>
                    Mark No-Show
                </button>
                <button class="btn-arrived" onclick="markStudentArrived('${service}')" ${currentlyServing === "None" || hasArrived ? "disabled" : ""}>
                    ${hasArrived ? "Ticket Arrived" : "Mark Arrived"}
                </button>
            </div>
        `;

        if (queue.length > 0) {
            const queueItems = card.querySelector(".queue-items");
            queue.forEach((student, index) => {
                queueItems.appendChild(createQueueItem(service, student, index));
            });
        }
        adminContainer.appendChild(card);
    });
}

function createQueueItem(serviceName, username, index) {
    const item = document.createElement("div");
    const label = document.createElement("span");
    const position = document.createElement("strong");
    const action = document.createElement("span");

    item.className = "queue-item";
    item.title = `Click to call ${username}`;
    position.textContent = `#${index + 1}`;
    label.append(position, ` - ${username}`);
    action.className = "ticket-tag";
    action.textContent = "Call Ticket →";
    item.append(label, action);
    item.addEventListener("click", () => callSpecificStudent(serviceName, username));

    return item;
}

function renderAdminNotifications() {
    const container = document.getElementById("adminNotifications");
    if (!container) return;

    const notifications = Storage.get("queueNotifications", []);
    container.replaceChildren();
    if (notifications.length === 0) return;

    const heading = document.createElement("h2");
    heading.textContent = "Recent queue activity";
    container.appendChild(heading);

    notifications.forEach(({ username, serviceName }) => {
        const message = document.createElement("p");
        const studentName = document.createElement("strong");
        const service = document.createElement("strong");

        studentName.textContent = username;
        service.textContent = serviceName;
        message.append(studentName, " joined the ", service, " queue.");
        container.appendChild(message);
    });
}

function callSpecificStudent(serviceName, username) {
    const serviceQueues = Storage.get("serviceQueues", {});
    const activeServing = Storage.get("activeServing", {});

    // Never silently discard the student already at the counter.
    if (activeServing[serviceName] && activeServing[serviceName] !== "None") {
        alert(`Finish or mark ${activeServing[serviceName]} as a no-show before calling another ticket.`);
        return;
    }

    // Remove selected student from waiting queue and place at counter.
    if (serviceQueues[serviceName]) {
        serviceQueues[serviceName] = serviceQueues[serviceName].filter(user => user !== username);
        activeServing[serviceName] = username;

        Storage.set("serviceQueues", serviceQueues);
        Storage.set("activeServing", activeServing);
        setTicketArrival(serviceName, false);
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
        setTicketArrival(serviceName, false);
        startNoShowTimer(serviceName);
        
        playCallSound();
        renderAdminDashboard();
    } else {
        activeServing[serviceName] = "None";
        Storage.set("activeServing", activeServing);
        setTicketArrival(serviceName, false);
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
        setTicketArrival(serviceName, false);
        clearNoShowTimer(serviceName);
        
        completeAndNext(serviceName);
    }
}

function markStudentArrived(serviceName) {
    const activeServing = Storage.get("activeServing", {});
    if (!activeServing[serviceName] || activeServing[serviceName] === "None") return;

    setTicketArrival(serviceName, true);
    clearNoShowTimer(serviceName);
    renderAdminDashboard();
}

function setTicketArrival(serviceName, hasArrived) {
    const serviceArrivals = Storage.get("serviceArrivals", {});
    serviceArrivals[serviceName] = hasArrived;
    Storage.set("serviceArrivals", serviceArrivals);
}

function updateServiceStatus(serviceName, status) {
    const serviceStatuses = Storage.get("serviceStatuses", {});
    serviceStatuses[serviceName] = status;
    Storage.set("serviceStatuses", serviceStatuses);
    renderAdminDashboard();
}

/* =========================================================
   9. ADMIN NO-SHOW COUNTDOWN: automatically handles expired tickets
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
    const serviceArrivals = Storage.get("serviceArrivals", {});
    let updated = false;

    Object.keys(activeServing).forEach(service => {
        if (activeServing[service] && activeServing[service] !== "None" && !deadlines[service] && !serviceArrivals[service]) {
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
    const serviceArrivals = Storage.get("serviceArrivals", {});
    const expiredService = Object.keys(activeServing).find(service =>
        activeServing[service] && activeServing[service] !== "None" &&
        !serviceArrivals[service] &&
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
   10. LIVE PAGE UPDATES: keeps student and admin views in sync
   ========================================================= */

window.addEventListener("storage", () => {
    const activeService = getActiveService();

    if (currentStudent === "admin") {
        renderAdminDashboard();
        return;
    }

    if (document.getElementById("dashboard").style.display !== "none") {
        updateServiceCards();
        updatePendingQueueCard();
    }

    if (activeService) {
        const activeServing = Storage.get("activeServing", {});
        const missedTickets = Storage.get("missedTickets", {});

        if (missedTickets[currentStudent]) {
            clearActiveService();
            showView("dashboard");
            checkMissedStatus();
            return;
        }

        if (activeServing[activeService] === currentStudent) {
            notifyTurnCalled(activeService);
            chooseService(activeService);
            return;
        }

        lastTurnAlert = "";

        if (document.getElementById("queuePage").style.display !== "none") {
            chooseService(activeService);
        }
    }
});

/* =========================================================
   11. SMALL UI UTILITY HELPERS
   ========================================================= */

function showStatusMessage(element, message, isSuccess) {
    if (!element) return;
    element.textContent = message;
    element.style.color = isSuccess ? "#10b981" : "#ef4444";
    element.style.display = "block";
}
