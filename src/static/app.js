document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupAccessMessage = document.getElementById("signup-access-message");
  const messageDiv = document.getElementById("message");
  const accountButton = document.getElementById("account-button");
  const accountMenu = document.getElementById("account-menu");
  const accountStatus = document.getElementById("account-status");
  const loginOpenButton = document.getElementById("login-open-button");
  const logoutButton = document.getElementById("logout-button");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const cancelLoginButton = document.getElementById("cancel-login");

  let isTeacher = false;

  function setTeacherState(authenticated, username = "") {
    isTeacher = authenticated;
    signupForm.hidden = !isTeacher;
    signupAccessMessage.hidden = isTeacher;
    loginOpenButton.hidden = isTeacher;
    logoutButton.hidden = !isTeacher;
    accountStatus.textContent = isTeacher ? `Signed in as ${username}` : "Student view";
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    window.setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  async function refreshTeacherState() {
    try {
      const response = await fetch("/auth/session");
      if (!response.ok) throw new Error("Could not check the teacher session");
      const session = await response.json();
      setTeacherState(session.authenticated, session.username || "");
    } catch (error) {
      setTeacherState(false);
      console.error("Error checking teacher session:", error);
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) throw new Error("Could not load activities");
      const activities = await response.json();
      activitiesList.replaceChildren();
      activitySelect.length = 1;

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        const spotsLeft =
          details.max_participants - details.participants.length;
        const title = document.createElement("h4");
        title.textContent = name;
        activityCard.appendChild(title);
        activityCard.appendChild(createDetail("", details.description));
        activityCard.appendChild(createDetail("Schedule:", details.schedule));
        activityCard.appendChild(createDetail("Availability:", `${spotsLeft} spots left`));
        activityCard.appendChild(createParticipants(name, details.participants));
        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  function createDetail(label, value) {
    const paragraph = document.createElement("p");
    if (label) {
      const strong = document.createElement("strong");
      strong.textContent = `${label} `;
      paragraph.appendChild(strong);
    }
    paragraph.appendChild(document.createTextNode(value));
    return paragraph;
  }

  function createParticipants(activity, participants) {
    const container = document.createElement("div");
    container.className = "participants-container";

    if (participants.length === 0) {
      const emptyMessage = document.createElement("p");
      const emphasis = document.createElement("em");
      emphasis.textContent = "No participants yet";
      emptyMessage.appendChild(emphasis);
      container.appendChild(emptyMessage);
      return container;
    }

    const heading = document.createElement("h5");
    heading.textContent = "Participants:";
    container.appendChild(heading);
    const list = document.createElement("ul");
    list.className = "participants-list";

    participants.forEach((email) => {
      const item = document.createElement("li");
      const emailText = document.createElement("span");
      emailText.className = "participant-email";
      emailText.textContent = email;
      item.appendChild(emailText);

      if (isTeacher) {
        const removeButton = document.createElement("button");
        removeButton.className = "delete-btn";
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.setAttribute("aria-label", `Remove ${email} from ${activity}`);
        removeButton.dataset.activity = activity;
        removeButton.dataset.email = email;
        removeButton.addEventListener("click", handleUnregister);
        item.appendChild(removeButton);
      }
      list.appendChild(item);
    });

    container.appendChild(list);
    return container;
  }

  async function handleUnregister(event) {
    if (!isTeacher) return;
    const button = event.currentTarget;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        await fetchActivities();
      } else {
        if (response.status === 401) await refreshTeacherState();
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isTeacher) return;

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        await fetchActivities();
      } else {
        if (response.status === 401) await refreshTeacherState();
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  accountButton.addEventListener("click", () => {
    const isExpanded = accountButton.getAttribute("aria-expanded") === "true";
    accountButton.setAttribute("aria-expanded", String(!isExpanded));
    accountMenu.hidden = isExpanded;
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".account-control")) {
      accountMenu.hidden = true;
      accountButton.setAttribute("aria-expanded", "false");
    }
  });

  loginOpenButton.addEventListener("click", () => {
    accountMenu.hidden = true;
    accountButton.setAttribute("aria-expanded", "false");
    loginMessage.textContent = "";
    loginDialog.showModal();
  });

  cancelLoginButton.addEventListener("click", () => loginDialog.close());

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        loginMessage.textContent = result.detail || "Login failed";
        return;
      }

      setTeacherState(true, result.username);
      loginForm.reset();
      loginDialog.close();
      await fetchActivities();
    } catch (error) {
      loginMessage.textContent = "Could not log in. Please try again.";
      console.error("Error logging in:", error);
    } finally {
      submitButton.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not end the teacher session");
      setTeacherState(false);
      await fetchActivities();
    } catch (error) {
      showMessage("Could not log out. Please try again.", "error");
      console.error("Error logging out:", error);
    }
    accountMenu.hidden = true;
    accountButton.setAttribute("aria-expanded", "false");
  });

  async function initialize() {
    await refreshTeacherState();
    await fetchActivities();
  }

  initialize();
});
