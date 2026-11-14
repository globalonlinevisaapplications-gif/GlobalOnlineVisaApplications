
/**
 * GLOBAL ONLINE VISA APPLICATIONS
 * Production Configuration - V17
 * Hosting: Netlify
 * Backend: Supabase
 */

(function () {
  "use strict";

  // ==========================================
  // WEBSITE CONFIGURATION
  // ==========================================

  window.SITE_NAME = "Global Online Visa Applications";

  window.SITE_URL =
    "https://globalonlinevisaapplication.netlify.app";

  window.SITE_ENVIRONMENT = "production";

  // ==========================================
  // SUPABASE PROJECT
  // ==========================================

  window.SUPABASE_URL =
    "https://iqpnlzufcasseycvmvzs.supabase.co";

  // CURRENT SUPABASE PUBLISHABLE KEY
  // Never put a secret or service_role key here.

  window.SUPABASE_ANON_KEY =
    "sb_publishable_W8PD_H5br4lYSFQ1BMMfyA_ywmLOsae";

  // ==========================================
  // V17 BACKEND
  // ==========================================

  window.SUPABASE_FUNCTION_URL =
    window.SUPABASE_URL +
    "/functions/v1/visa-backend-v17";

  // ==========================================
  // INITIALIZE SUPABASE
  // ==========================================

  if (
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    if (!window.supabaseClient) {
      window.supabaseClient =
        window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_ANON_KEY
        );
    }
  } else {
    console.error(
      "Supabase library not loaded. Check script loading order."
    );
  }

  // ==========================================
  // API CONFIGURATION
  // ==========================================

  window.API_CONFIG = {
    baseURL: window.SUPABASE_FUNCTION_URL,
    method: "POST",
    timeout: 30000,

    headers: {
      "Content-Type": "application/json",
      "apikey": window.SUPABASE_ANON_KEY
    }
  };

  // ==========================================
  // WEBSITE ROUTES
  // ==========================================

  window.APP_ROUTES = {
    home: window.SITE_URL + "/",
    apply: window.SITE_URL + "/apply.html",
    success: window.SITE_URL + "/thank-you.html",
    contact: window.SITE_URL + "/contact.html",
    admin: window.SITE_URL + "/admin.html"
  };

  // ==========================================
  // APPLICATION SETTINGS
  // ==========================================

  window.APP_CONFIG = {
    applicationName:
      "Global Online Visa Applications",

    currency: "USD",

    defaultCountry: "",

    allowApplicationSubmission: true,

    productionMode: true,

    backendVersion: "visa-backend-v17",

    emailWorker: "integrated-gmail-api",

    serviceFeePerApplicant: 285,

    maximumApplicants: 10,

    websiteURL: window.SITE_URL
  };

  // ==========================================
  // VALIDATE CONFIGURATION
  // ==========================================

  window.validateAppConfig = function () {
    return (
      typeof window.SITE_URL === "string" &&
      typeof window.SUPABASE_URL === "string" &&
      typeof window.SUPABASE_ANON_KEY === "string" &&
      window.SITE_URL ===
        "https://globalonlinevisaapplication.netlify.app" &&
      window.SUPABASE_URL ===
        "https://iqpnlzufcasseycvmvzs.supabase.co" &&
      window.SUPABASE_FUNCTION_URL ===
        window.SUPABASE_URL +
        "/functions/v1/visa-backend-v17" &&
      window.APP_CONFIG.backendVersion ===
        "visa-backend-v17"
    );
  };

  // ==========================================
  // GET AUTHENTICATED USER TOKEN
  // ==========================================

  window.getAccessToken = async function () {
    if (!window.supabaseClient) {
      throw new Error(
        "Supabase client is not initialized."
      );
    }

    const { data, error } =
      await window.supabaseClient.auth.getSession();

    if (error) {
      throw new Error(
        "Could not retrieve your login session: " +
        error.message
      );
    }

    const token = data.session?.access_token;

    if (!token) {
      throw new Error(
        "Please sign in before continuing."
      );
    }

    return token;
  };

  // ==========================================
  // CALL V17 BACKEND
  // ==========================================

  window.callVisaBackend = async function (requestData) {
    if (!window.validateAppConfig()) {
      throw new Error(
        "Application configuration is invalid."
      );
    }

    if (!window.supabaseClient) {
      throw new Error(
        "Supabase client is not initialized."
      );
    }

    if (
      !requestData ||
      typeof requestData !== "object" ||
      Array.isArray(requestData)
    ) {
      throw new Error(
        "Invalid request data."
      );
    }

    const token = await window.getAccessToken();

    const controller = new AbortController();

    const timeout = setTimeout(function () {
      controller.abort();
    }, window.API_CONFIG.timeout);

    try {
      const response = await fetch(
        window.SUPABASE_FUNCTION_URL,
        {
          method: "POST",

          headers: {
            ...window.API_CONFIG.headers,
            "Authorization": "Bearer " + token
          },

          body: JSON.stringify(requestData),

          signal: controller.signal
        }
      );

      const result = await response.json().catch(
        function () {
          return {};
        }
      );

      if (
        !response.ok ||
        result.ok === false ||
        result.success === false
      ) {
        throw new Error(
          result.error ||
          result.message ||
          "Backend request failed. HTTP status: " +
          response.status
        );
      }

      if (
        result.version &&
        result.version !==
          window.APP_CONFIG.backendVersion
      ) {
        throw new Error(
          "Backend version mismatch."
        );
      }

      return result;

    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Request timed out. Please try again."
        );
      }

      throw error;

    } finally {
      clearTimeout(timeout);
    }
  };

  // ==========================================
  // SUBMIT APPLICATION
  // ==========================================

  window.submitVisaApplication =
    async function (applicationData) {
      return await window.callVisaBackend(
        applicationData
      );
    };

  // ==========================================
  // WEBSITE NAVIGATION
  // ==========================================

  window.navigateTo = function (page) {
    const destination =
      window.APP_ROUTES[page];

    if (!destination) {
      throw new Error(
        "Invalid website page."
      );
    }

    window.location.href = destination;
  };

  // ==========================================
  // INITIALIZATION MESSAGE
  // ==========================================

  if (window.validateAppConfig()) {
    console.info(
      "Global Online Visa Applications configuration loaded - V17."
    );
  } else {
    console.error(
      "Application configuration is invalid."
    );
  }

})();
