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
}

initDatabase();

let currentStudent = localStorage.getItem("loggedInUser") || "";

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
        } else if (activeService) {
            chooseService(activeService);
        } else {
            showView("dashboard");
            checkMissedStatus();
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
        } else {
            showView("dashboard");
            checkMissedStatus();
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
}

/* =========================================================
   8. ADMIN PANEL WITH CLICKABLE QUEUE SELECTION
   ========================================================= */

function renderAdminDashboard() {
    const adminContainer = document.getElementById("adminQueueList");
    if (!adminContainer) return;

    const serviceQueues = Storage.get("serviceQueues", {});
    const activeServing = Storage.get("activeServing", {});
    adminContainer.innerHTML = "";

    Object.keys(serviceQueues).forEach(service => {
        const queue = serviceQueues[service];
        const currentlyServing = activeServing[service] || "None";

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
        
        playCallSound();
        renderAdminDashboard();
    } else {
        activeServing[serviceName] = "None";
        Storage.set("activeServing", activeServing);
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
        
        completeAndNext(serviceName);
    }
}

/* =========================================================
   9. REAL-TIME STORAGE & SYNC ENGINE
   ========================================================= */

window.addEventListener("storage", () => {
    const activeService = localStorage.getItem("activeService");

    if (currentStudent === "admin") {
        renderAdminDashboard();
        return;
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