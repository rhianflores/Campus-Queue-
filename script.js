/* =========================================================
   1. DATABASE INITIALIZATION (localStorage)
   ========================================================= */

if (!localStorage.getItem("users")) {
    const defaultUsers = {
        "student1": "password123",
        "admin": "admin123"
    };
    localStorage.setItem("users", JSON.stringify(defaultUsers));
}

if (!localStorage.getItem("serviceQueues")) {
    const defaultQueues = {
        "Registrar": [],
        "Cashier": [],
        "Clinic": [],
        "Library": [],
        "Student Services": []
    };
    localStorage.setItem("serviceQueues", JSON.stringify(defaultQueues));
}

// Restore active student session
let currentStudent = localStorage.getItem("loggedInUser") || "";

/* =========================================================
   2. SESSION & STATE RESTORATION ON LOAD
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const activeService = localStorage.getItem("activeService");

    if (currentStudent) {
        document.getElementById("displayUsername").textContent = currentStudent;
        
        if (activeService) {
            // Restore active queue page view
            chooseService(activeService);
        } else {
            // Restore active dashboard view
            document.getElementById("loginPage").style.display = "none";
            document.getElementById("dashboard").style.display = "block";
            document.getElementById("queuePage").style.display = "none";
        }
    } else {
        // Fallback to initial login screen
        document.getElementById("loginPage").style.display = "flex";
        document.getElementById("dashboard").style.display = "none";
        document.getElementById("queuePage").style.display = "none";
    }
});

/* =========================================================
   3. UI FORM TOGGLING (Login vs Register)
   ========================================================= */

function toggleAuthMode(event, mode) {
    if (event) event.preventDefault();

    const loginSec = document.getElementById("loginSection");
    const regSec = document.getElementById("registerSection");

    document.getElementById("loginError").style.display = "none";
    document.getElementById("registerMessage").style.display = "none";

    if (mode === "register") {
        loginSec.style.display = "none";
        regSec.style.display = "block";
    } else {
        regSec.style.display = "none";
        loginSec.style.display = "block";
    }
}

/* =========================================================
   4. ACCOUNT REGISTRATION LOGIC
   ========================================================= */

document.getElementById("registerForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const regUsername = document.getElementById("regUsername").value.trim();
    const regPassword = document.getElementById("regPassword").value.trim();
    const regMsg = document.getElementById("registerMessage");

    if (!regUsername || !regPassword) {
        regMsg.style.color = "#ff7777";
        regMsg.textContent = "Please fill in all fields.";
        regMsg.style.display = "block";
        return;
    }

    const users = JSON.parse(localStorage.getItem("users"));

    if (users[regUsername]) {
        regMsg.style.color = "#ff7777";
        regMsg.textContent = "Username already exists! Try another.";
        regMsg.style.display = "block";
        return;
    }

    users[regUsername] = regPassword;
    localStorage.setItem("users", JSON.stringify(users));

    regMsg.style.color = "#5cdb95";
    regMsg.textContent = "Account created! Switching to login...";
    regMsg.style.display = "block";

    document.getElementById("username").value = regUsername;
    document.getElementById("password").value = regPassword;

    document.getElementById("regUsername").value = "";
    document.getElementById("regPassword").value = "";

    setTimeout(() => {
        toggleAuthMode(null, "login");
    }, 1500);
});

/* =========================================================
   5. AUTHENTICATION (Login & Logout)
   ========================================================= */

document.getElementById("loginForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value.trim();
    const loginError = document.getElementById("loginError");

    const users = JSON.parse(localStorage.getItem("users"));

    if (users[usernameInput] && users[usernameInput] === passwordInput) {
        currentStudent = usernameInput;
        
        // Save session locally to prevent losing progress on refresh
        localStorage.setItem("loggedInUser", currentStudent);

        document.getElementById("displayUsername").textContent = currentStudent;

        document.getElementById("loginPage").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        loginError.style.display = "none";
    } else {
        loginError.textContent = "Invalid username or password!";
        loginError.style.display = "block";
    }
});

function logout() {
    currentStudent = "";

    // Remove persistent session data on logout
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("activeService");

    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    document.getElementById("rememberMe").checked = false;
    document.getElementById("loginError").style.display = "none";

    document.getElementById("dashboard").style.display = "none";
    document.getElementById("queuePage").style.display = "none";
    document.getElementById("loginPage").style.display = "flex";

    toggleAuthMode(null, "login");
}

/* =========================================================
   6. REAL QUEUE SYSTEM LOGIC
   ========================================================= */

function chooseService(serviceName) {
    const serviceQueues = JSON.parse(localStorage.getItem("serviceQueues"));

    if (!serviceQueues[serviceName]) {
        serviceQueues[serviceName] = [];
    }

    const currentQueue = serviceQueues[serviceName];
    let userIndex = currentQueue.indexOf(currentStudent);

    if (userIndex === -1) {
        currentQueue.push(currentStudent);
        localStorage.setItem("serviceQueues", JSON.stringify(serviceQueues));
        userIndex = currentQueue.length - 1;
    }

    // Preserve current service across reloads
    localStorage.setItem("activeService", serviceName);

    const queueTicketNumber = userIndex + 1;
    const peopleAhead = userIndex;
    const estimatedWaitTime = peopleAhead * 5;

    document.getElementById("queueStudent").textContent = currentStudent;
    document.getElementById("queueService").textContent = serviceName;
    document.getElementById("queuePeople").textContent = peopleAhead;
    document.getElementById("queueWaitTime").textContent = estimatedWaitTime;
    document.getElementById("queueNumber").textContent = String(queueTicketNumber).padStart(2, "0");

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("queuePage").style.display = "block";
}

function backToServices() {
    localStorage.removeItem("activeService");
    document.getElementById("queuePage").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
}

/* =========================================================
   7. LIVE MULTI-TAB SYNCHRONIZATION
   ========================================================= */

window.addEventListener("storage", function (event) {
    if (event.key === "serviceQueues") {
        const activeService = localStorage.getItem("activeService");
        if (activeService && document.getElementById("queuePage").style.display === "block") {
            chooseService(activeService);
        }
    }
});

/* =========================================================
   8. DEMO HELPER (SERVE QUEUE TICKET VIA CONSOLE)
   ========================================================= */

function serveNextStudent(serviceName) {
    const serviceQueues = JSON.parse(localStorage.getItem("serviceQueues"));
    if (serviceQueues[serviceName] && serviceQueues[serviceName].length > 0) {
        const servedUser = serviceQueues[serviceName].shift();
        localStorage.setItem("serviceQueues", JSON.stringify(serviceQueues));
        console.log("Served student:", servedUser);
    }
}

/* =========================================================
   9. UTILITIES
   ========================================================= */

document.getElementById("resetPassword").addEventListener("click", function (event) {
    event.preventDefault();
    alert("Demo Password Reset: Default accounts are 'student1' / 'password123' and 'admin' / 'admin123'.");
});