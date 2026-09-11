/* ================================================
   VARIABLES
================================================= */

let currentStudent = "";

/* ================================================
   LOGIN
================================================= */

document
  .getElementById("loginForm")
  .addEventListener("submit", function (event) {
    // Prevent the form from refreshing the page
    event.preventDefault();

    // Get input values
    const username = document.getElementById("username").value.trim();

    const password = document.getElementById("password").value.trim();

    // Check if fields are empty
    if (username === "" || password === "") {
      document.getElementById("loginError").style.display = "block";

      return;
    }

    // Store username
    currentStudent = username;

    // Display username
    document.getElementById("displayUsername").textContent = currentStudent;

    // Hide error
    document.getElementById("loginError").style.display = "none";

    // Hide login, play loader, then show dashboard
    playSectionTransition("loginPage", "dashboard", "block");
  });

/* ================================================
   SECTION TRANSITION LOADER
   Plays the constellation draw-in animation while
   switching between Dashboard and Queue.
================================================= */

const LOADER_DURATION = 2100; // ms, matches the SVG draw-in timing

function playSectionTransition(hideIds, showId, showDisplay) {
  const loader = document.getElementById("sectionLoader");

  // Allow a single id or an array of ids to hide
  const idsToHide = Array.isArray(hideIds) ? hideIds : [hideIds];

  idsToHide.forEach(function (id) {
    document.getElementById(id).style.display = "none";
  });

  // Reset display first so the browser treats this as a fresh
  // element (this restarts the CSS draw-in animations every time)
  loader.style.display = "none";
  void loader.offsetWidth; // force reflow
  loader.style.display = "flex";

  setTimeout(function () {
    loader.style.display = "none";
    document.getElementById(showId).style.display = showDisplay || "block";
  }, LOADER_DURATION);
}

/* ================================================
   CHOOSE SERVICE
================================================= */

function chooseService(service) {
  /*
        TEMPORARY QUEUE SIMULATION

        Your original Python program asks:

        "How many people are already in the queue?"

        Since this is only a front-end prototype,
        we generate a temporary value.

        A real system would get this number
        from a database.
    */

  const peopleAhead = Math.floor(Math.random() * 10);

  const queueNumber = peopleAhead + 1;

  // Display student

  document.getElementById("queueStudent").textContent = currentStudent;

  // Display service

  document.getElementById("queueService").textContent = service;

  // Display people ahead

  document.getElementById("queuePeople").textContent = peopleAhead;

  // Display queue number

  document.getElementById("queueNumber").textContent = String(
    queueNumber,
  ).padStart(2, "0");

  // Hide dashboard, play loader, then show queue page

  playSectionTransition("dashboard", "queuePage");
}

/* ================================================
   BACK TO SERVICES
================================================= */

function backToServices() {
  playSectionTransition("queuePage", "dashboard");
}

/* ================================================
   LOGOUT
================================================= */

function logout() {
  // Clear student data

  currentStudent = "";

  // Clear form

  document.getElementById("username").value = "";

  document.getElementById("password").value = "";

  document.getElementById("rememberMe").checked = false;

  document.getElementById("loginError").style.display = "none";

  // Hide dashboard/queue page, play loader, then return to login
  // (loginPage needs "flex" display, since it's a centered layout)

  playSectionTransition(["dashboard", "queuePage"], "loginPage", "flex");
}

/* ================================================
   FORGOT PASSWORD
================================================= */

document
  .getElementById("resetPassword")
  .addEventListener("click", function (event) {
    event.preventDefault();

    alert("Password reset functionality will be available in the full system.");
  });
