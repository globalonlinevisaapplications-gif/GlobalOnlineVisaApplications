/* Public anon key only. Never place a Supabase service-role key in browser code. */
const SUPABASE_URL = window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const db = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const enquiryForm = document.getElementById("enquiry-form");
if (enquiryForm) {
  enquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("form-status");
    const submit = enquiryForm.querySelector('button[type="submit"]');
    status.textContent = "Sending your enquiry…";
    submit.disabled = true;
    const formData = new FormData(enquiryForm);
    const record = {
      full_name: String(formData.get("full_name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      residence: String(formData.get("residence") || "").trim(),
      destination: String(formData.get("destination") || ""),
      purpose: String(formData.get("purpose") || ""),
      travel_timing: String(formData.get("travel_timing") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      consent: formData.get("consent") === "yes"
    };
    try {
      if (db) {
        const { error } = await db.from("enquiries").insert(record);
        if (error) throw error;
      }
      /* Also send to Netlify Forms. Netlify detects the matching static form in apply.html. */
      const body = new URLSearchParams();
      for (const [key, value] of formData.entries()) body.append(key, String(value));
      const response = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
      if (!response.ok) throw new Error("The form host did not accept the submission. Please try again.");
      status.textContent = "Thank you. Your enquiry has been received.";
      enquiryForm.reset();
    } catch (error) {
      console.error(error);
      status.textContent = error.message || "Sorry, something went wrong. Please try again.";
    } finally { submit.disabled = false; }
  });
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
  const loginPanel = document.getElementById("login-panel");
  const dashboardPanel = document.getElementById("dashboard-panel");
  const loginStatus = document.getElementById("login-status");
  const dashStatus = document.getElementById("dashboard-status");
  const tbody = document.getElementById("applications-body");

  function showSession(session) {
    loginPanel.hidden = Boolean(session);
    dashboardPanel.hidden = !session;
    if (session) loadEnquiries();
  }
  async function loadEnquiries() {
    if (!db) { dashStatus.textContent = "Supabase is not configured yet. Follow README.md to add your project URL and public anon key."; return; }
    dashStatus.textContent = "Loading enquiries…";
    const { data, error } = await db.from("enquiries").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) { dashStatus.textContent = "Could not load enquiries: " + error.message; return; }
    tbody.replaceChildren();
    for (const item of data || []) {
      const tr = document.createElement("tr");
      const values = [
        new Date(item.created_at).toLocaleDateString(),
        `${item.full_name || ""}\n${item.email || ""}\n${item.phone || ""}`,
        item.destination || "", item.purpose || "", item.message || ""
      ];
      for (const value of values) { const td = document.createElement("td"); td.textContent = value; tr.appendChild(td); }
      const statusCell = document.createElement("td");
      const select = document.createElement("select");
      for (const state of ["New", "In progress", "Awaiting customer", "Closed"]) {
        const option = document.createElement("option"); option.value = state; option.textContent = state; select.appendChild(option);
      }
      select.value = item.status || "New";
      select.addEventListener("change", async () => {
        select.disabled = true;
        const { error: updateError } = await db.from("enquiries").update({ status: select.value }).eq("id", item.id);
        dashStatus.textContent = updateError ? "Status update failed: " + updateError.message : "Status updated.";
        select.disabled = false;
      });
      statusCell.appendChild(select); tr.appendChild(statusCell); tbody.appendChild(tr);
    }
    dashStatus.textContent = `${(data || []).length} recent enquiry record(s).`;
  }
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!db) { loginStatus.textContent = "Supabase is not configured. Follow README.md first."; return; }
    loginStatus.textContent = "Signing in…";
    const { error } = await db.auth.signInWithPassword({
      email: document.getElementById("admin-email").value.trim(),
      password: document.getElementById("admin-password").value
    });
    loginStatus.textContent = error ? "Login failed: " + error.message : "";
    if (!error) { const { data } = await db.auth.getSession(); showSession(data.session); }
  });
  document.getElementById("logout-btn").addEventListener("click", async () => { await db.auth.signOut(); showSession(null); });
  if (!db) { loginStatus.textContent = "Setup required: add your Supabase URL and public anon key in config.js."; }
  else { db.auth.getSession().then(({ data }) => showSession(data.session)); db.auth.onAuthStateChange((_event, session) => showSession(session)); }
}