
/**
 * GLOBAL ONLINE VISA APPLICATIONS
 * Production Configuration - V15
 *
 * File: config.js
 * Hosting: Netlify
 * Backend: Supabase
 * Application Backend: visa-backend-v15
 * Email Worker: bright-worker-v11
 */

(function () {
  "use strict";

  // WEBSITE CONFIGURATION
  window.SITE_NAME = "Global Online Visa Applications";

  window.SITE_URL =
    "https://globalonlinevisaapplications.netlify.app";

  window.SITE_ENVIRONMENT = "production";

  // SUPABASE CONFIGURATION
  window.SUPABASE_URL =
    "https://iqpnlzufcasseycvmvzs.supabase.co";

  window.SUPABASE_ANON_KEY =
    "sb_publishable_W8PD-H5br4lYSFQ1BMMfyA_ywmLOsae";

  // SUPABASE EDGE FUNCTION — V15
  window.SUPABASE_FUNCTION_URL =
    window.SUPABASE_URL +
    "/functions/v1/visa-backend-v15";

  // SUPABASE CLIENT
  // Reuses the Supabase library loaded by the website.
  if (
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    window.supabaseClient =
      window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
  }

  // API CONFIGURATION
  window.API_CONFIG = {
    baseURL: window.SUPABASE_FUNCTION_URL,
    method: "POST",
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "apikey": window.SUPABASE_ANON_KEY
    }
  };

  // APPLICATION ROUTES
  window.APP_ROUTES = {
    home: window.SITE_URL + "/",
    apply: window.SITE_URL + "/apply.html",
    success: window.SITE_URL + "/success.html",
    contact: window.SITE_URL + "/contact.html",
    admin: window.SITE_URL + "/admin.html"
  };

  // APPLICATION SETTINGS
  window.APP_CONFIG = {
    applicationName: "Global Online Visa Applications",
    currency: "USD",
    defaultCountry: "",
    allowApplicationSubmission: true,
    productionMode: true,
    backendVersion: "visa-backend-v15",
    emailWorker: "bright-worker-v11",
    serviceFeePerApplicant: 285,
    maximumApplicants: 10,
    websiteURL: window.SITE_URL
  };

  // CONFIGURATION VALIDATION
  window.validateAppConfig = function () {
    const required = [
      window.SITE_URL,
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY,
      window.SUPABASE_FUNCTION_URL
    ];

    return required.every(function (value) {
      return typeof value === "string" &&
        value.trim().length > 0;
    }) &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(
        window.SUPABASE_URL
      );
  };

  // GET SIGNED-IN USER ACCESS TOKEN
  window.getAccessToken = async function () {
    if (!window.supabaseClient) {
      throw new Error(
        "Supabase client is not initialized. Load the Supabase library before config.js."
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

  // GENERAL BACKEND REQUEST
  window.callVisaBackend = async function (
    requestData
  ) {
    if (!window.validateAppConfig()) {
      throw new Error(
        "Application configuration is incomplete or invalid."
      );
    }

    if (
      !requestData ||
      typeof requestData !== "object" ||
      Array.isArray(requestData)
    ) {
      throw new Error("Invalid request data.");
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

      if (!response.ok || result.ok === false ||
          result.success === false) {
        throw new Error(
          result.error ||
          result.message ||
          "Backend request failed. Please try again."
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

  // APPLICATION SUBMISSION
  window.submitVisaApplication = async function (
    applicationData
  ) {
    return await window.callVisaBackend(
      applicationData
    );
  };

  // WEBSITE NAVIGATION
  window.navigateTo = function (page) {
    const destination = window.APP_ROUTES[page];

    if (!destination) {
      throw new Error("Invalid website page.");
    }

    window.location.href = destination;
  };

  // INITIALIZATION
  if (window.validateAppConfig()) {
    console.info(
      "Global Online Visa Applications configuration loaded - V15."
    );

    console.info(
      "Official website:",
      window.SITE_URL
    );

    console.info(
      "Backend:",
      window.SUPABASE_FUNCTION_URL
    );

    console.info(
      "Email worker:",
      "bright-worker-v11"
    );

  } else {
    console.error(
      "Application configuration is incomplete or invalid."
    );
  }

})();
