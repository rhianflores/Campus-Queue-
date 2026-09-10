/* ================================================
   VARIABLES
================================================= */

let currentStudent = "";

/* ================================================
   LOGIN
================================================= */

document
    .getElementById("loginForm")
    .addEventListener("submit", function(event) {

        // Prevent the form from refreshing the page
        event.preventDefault();

        // Get input values
        const username =
            document
                .getElementById("username")
                .value
                .trim();

        const password =
            document
                .getElementById("password")
                .value
                .trim();

        // Check if fields are empty
        if (username === "" || password === "") {

            document
                .getElementById("loginError")
                .style.display = "block";

            return;
        }

        // Store username
        currentStudent = username;

        // Display username
        document
            .getElementById("displayUsername")
            .textContent = currentStudent;

        // Hide login
        document
            .getElementById("loginPage")
            .style.display = "none";

        // Show dashboard
        document
            .getElementById("dashboard")
            .style.display = "block";

        // Hide error
        document
            .getElementById("loginError")
            .style.display = "none";

    });

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

    const peopleAhead =
        Math.floor(Math.random() * 10);

    const queueNumber =
        peopleAhead + 1;

    // Display student

    document
        .getElementById("queueStudent")
        .textContent = currentStudent;

    // Display service

    document
        .getElementById("queueService")
        .textContent = service;

    // Display people ahead

    document
        .getElementById("queuePeople")
        .textContent = peopleAhead;

    // Display queue number

    document
        .getElementById("queueNumber")
        .textContent =
            String(queueNumber).padStart(2, "0");

    // Hide dashboard

    document
        .getElementById("dashboard")
        .style.display = "none";

    // Show queue page

    document
        .getElementById("queuePage")
        .style.display = "block";

}

/* ================================================
   BACK TO SERVICES
================================================= */

function backToServices() {

    document
        .getElementById("queuePage")
        .style.display = "none";

    document
        .getElementById("dashboard")
        .style.display = "block";

}

/* ================================================
   LOGOUT
================================================= */

function logout() {

    // Clear student data

    currentStudent = "";

    // Clear form

    document
        .getElementById("username")
        .value = "";

    document
        .getElementById("password")
        .value = "";

    document
        .getElementById("rememberMe")
        .checked = false;

    document
        .getElementById("loginError")
        .style.display = "none";

    // Hide dashboard

    document
        .getElementById("dashboard")
        .style.display = "none";

    // Hide queue page

    document
        .getElementById("queuePage")
        .style.display = "none";

    // Return to login

    document
        .getElementById("loginPage")
        .style.display = "flex";

}

/* ================================================
   FORGOT PASSWORD
================================================= */

document
    .getElementById("resetPassword")
    .addEventListener("click", function(event) {

        event.preventDefault();

        alert(
            "Password reset functionality will be available in the full system."
        );

    });
