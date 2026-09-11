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
            alert("Demo Password Reset: Default accounts are 'student1' / 'password123' and 'admin' / 'admin123'.");
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
   7. STUDENT QUEUE LOGIC (CHOOSE / LEAVE QUEUE)
   ========================================================= */

function chooseService(serviceName) {
    const serviceQueues = Storage.get("serviceQueues", {});

    if (!serviceQueues[serviceName]) {
        serviceQueues[serviceName] = [];
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
   8. STAFF ADMIN PANEL CONTROLLER
   ========================================================= */

function renderAdminDashboard() {
    const adminContainer = document.getElementById("adminQueueList");
    if (!adminContainer) return;

    const serviceQueues = Storage.get("serviceQueues", {});
    adminContainer.innerHTML = "";

    Object.keys(serviceQueues).forEach(service => {
        const queue = serviceQueues[service];
        const nextUser = queue[0] || "None";

        const card = document.createElement("div");
        card.className = "admin-service-card";
        card.innerHTML = `
            <h3>${service}</h3>
            <p><strong>In Queue:</strong> ${queue.length} students</p>
            <p><strong>Next in Line:</strong> ${nextUser}</p>
            <button onclick="serveNextStudent('${service}')">Call Next Student</button>
        `;
        adminContainer.appendChild(card);
    });
}

function serveNextStudent(serviceName) {
    const serviceQueues = Storage.get("serviceQueues", {});

    if (serviceQueues[serviceName] && serviceQueues[serviceName].length > 0) {
        const servedUser = serviceQueues[serviceName].shift();
        Storage.set("serviceQueues", serviceQueues);
        playCallSound();
        renderAdminDashboard();
        return servedUser;
    }
    
    alert(`No students currently waiting for ${serviceName}.`);
    return null;
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

    if (activeService && document.getElementById("queuePage").style.display !== "none") {
        const serviceQueues = Storage.get("serviceQueues", {});
        const currentQueue = serviceQueues[activeService] || [];

        if (!currentQueue.includes(currentStudent)) {
            playCallSound();
            alert("It's your turn! Please proceed to the department counter.");
            Storage.remove("activeService");
            showView("dashboard");
        } else {
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