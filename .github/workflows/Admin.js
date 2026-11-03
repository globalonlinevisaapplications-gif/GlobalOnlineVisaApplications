
document.addEventListener("DOMContentLoaded", () => {

    const config = window.APP_CONFIG;

    const status = document.getElementById("admin-status");
    const loginForm = document.getElementById("login-form");
    const logoutButton = document.getElementById("logout");
    const adminData = document.getElementById("admin-data");

    if (
        !config ||
        config.SUPABASE_URL.includes("YOUR-PROJECT") ||
        config.SUPABASE_ANON_KEY.includes("YOUR_")
    ) {
        status.textContent =
            "Please configure Supabase in config.js first.";
        return;
    }

    const supabaseClient = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY
    );

    // Display records safely
    function displayRecords(elementId, records) {

        const container = document.getElementById(elementId);

        container.replaceChildren();

        if (!records || records.length === 0) {
            container.textContent = "No records found.";
            return;
        }

        records.forEach(record => {

            const card = document.createElement("div");
            card.className = "service-box";

            const details = document.createElement("pre");
            details.textContent = JSON.stringify(record, null, 2);

            card.appendChild(details);
            container.appendChild(card);

        });
    }

    // Load customer enquiries
    async function loadDashboard() {

        const { data: userData, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            status.textContent = "Please sign in.";
            return;
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", userData.user.id)
                .single();

        if (profileError || !profile || profile.role !== "admin") {
            status.textContent =
                "Access denied. Administrator permission required.";
            await supabaseClient.auth.signOut();
            return;
        }

        loginForm.hidden = true;
        logoutButton.hidden = false;
        adminData.hidden = false;

        status.textContent = "Welcome, administrator.";

        const { data: applications, error: appError } =
            await supabaseClient
                .from("applications")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);

        const { data: messages, error: messageError } =
            await supabaseClient
                .from("contact_messages")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);

        if (appError || messageError) {
            status.textContent =
                "Unable to load records. Check database permissions.";
            return;
        }

        displayRecords("applications", applications);
        displayRecords("messages", messages);
    }

    // Administrator login
    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const formData = new FormData(loginForm);

        const email = formData.get("email");
        const password = formData.get("password");

        status.textContent = "Signing in...";

        const { error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            status.textContent = "Login failed: " + error.message;
            return;
        }

        await loadDashboard();

    });

    // Administrator logout
    logoutButton.addEventListener("click", async () => {

        await supabaseClient.auth.signOut();

        adminData.hidden = true;
        logoutButton.hidden = true;
        loginForm.hidden = false;

        status.textContent = "You have signed out.";

    });

    // Check existing session
    loadDashboard();

});
document.addEventListener("DOMContentLoaded", () => {

    const config = window.APP_CONFIG;

    const status = document.getElementById("admin-status");
    const loginForm = document.getElementById("login-form");
    const logoutButton = document.getElementById("logout");
    const adminData = document.getElementById("admin-data");

    if (
        !config ||
        config.SUPABASE_URL.includes("YOUR-PROJECT") ||
        config.SUPABASE_ANON_KEY.includes("YOUR_")
    ) {
        status.textContent =
            "Please configure Supabase in config.js first.";
        return;
    }

    const supabaseClient = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY
    );

    // Display records safely
    function displayRecords(elementId, records) {

        const container = document.getElementById(elementId);

        container.replaceChildren();

        if (!records || records.length === 0) {
            container.textContent = "No records found.";
            return;
        }

        records.forEach(record => {

            const card = document.createElement("div");
            card.className = "service-box";

            const details = document.createElement("pre");
            details.textContent = JSON.stringify(record, null, 2);

            card.appendChild(details);
            container.appendChild(card);

        });
    }

    // Load customer enquiries
    async function loadDashboard() {

        const { data: userData, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            status.textContent = "Please sign in.";
            return;
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", userData.user.id)
                .single();

        if (profileError || !profile || profile.role !== "admin") {
            status.textContent =
                "Access denied. Administrator permission required.";
            await supabaseClient.auth.signOut();
            return;
        }

        loginForm.hidden = true;
        logoutButton.hidden = false;
        adminData.hidden = false;

        status.textContent = "Welcome, administrator.";

        const { data: applications, error: appError } =
            await supabaseClient
                .from("applications")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);

        const { data: messages, error: messageError } =
            await supabaseClient
                .from("contact_messages")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);

        if (appError || messageError) {
            status.textContent =
                "Unable to load records. Check database permissions.";
            return;
        }

        displayRecords("applications", applications);
        displayRecords("messages", messages);
    }

    // Administrator login
    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const formData = new FormData(loginForm);

        const email = formData.get("email");
        const password = formData.get("password");

        status.textContent = "Signing in...";

        const { error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            status.textContent = "Login failed: " + error.message;
            return;
        }

        await loadDashboard();

    });

    // Administrator logout
    logoutButton.addEventListener("click", async () => {

        await supabaseClient.auth.signOut();

        adminData.hidden = true;
        logoutButton.hidden = true;
        loginForm.hidden = false;

        status.textContent = "You have signed out.";

    });

    // Check existing session
    loadDashboard();

});
