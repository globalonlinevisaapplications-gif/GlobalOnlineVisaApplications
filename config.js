
/**
 * GLOBAL ONLINE VISA APPLICATIONS
 * Production Configuration - V13
 *
 * File: config.js
 * Hosting: Netlify
 * Backend: Supabase
 */

(function () {
  "use strict";

  // WEBSITE CONFIGURATION
  window.SITE_NAME = "Global Online Visa Applications";

  // OFFICIAL WEBSITE URL
  window.SITE_URL =
    "https://globalonlinevisaapplications.netlify.app";

  window.SITE_ENVIRONMENT = "production";

  // SUPABASE CONFIGURATION
  window.SUPABASE_URL =
    "https://iqpnlzufcasse…";

  window.SUPABASE_ANON_KEY =
    "sb_publishable_W8PD_H5br4lYSFQ1BMMfyA_ywmLOsae";

  // SUPABASE EDGE FUNCTION — V13
  window.SUPABASE_FUNCTION_URL =
    window.SUPABASE_URL +
    "/functions/v1/visa-backend-v13";

  // API CONFIGURATION
  window.API_CONFIG = {
    baseURL: window.SUPABASE_FUNCTION_URL,
    method: "POST",
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "apikey": window.SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + window.SUPABASE_ANON_KEY
    }
  };

  // APPLICATION ROUTES — OFFICIAL WEBSITE
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
    backendVersion: "visa-backend-v13",
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
        value.length > 0;
    });
  };

  // BACKEND CONNECTION
  window.submitVisaApplication = async function (applicationData) {

    if (!window.validateAppConfig()) {
      throw new Error(
        "Application configuration is incomplete."
      );
    }

    if (!applicationData ||
        typeof applicationData !== "object" ||
        Array.isArray(applicationData)) {
      throw new Error("Invalid application data.");
    }

    const response = await fetch(
      window.SUPABASE_FUNCTION_URL,
      {
        method: "POST",
        headers: window.API_CONFIG.headers,
        body: JSON.stringify(applicationData)
      }
    );

    const result = await response.json().catch(function () {
      return {};
    });

    if (!response.ok || result.ok === false) {
      throw new Error(
        result.message ||
        result.error ||
        "Application submission failed. Please try again."
      );
    }

    return result;
  };

  // WEBSITE NAVIGATION HELPER
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
      "Global Online Visa Applications configuration loaded - V13."
    );

    console.info(
      "Official website:",
      window.SITE_URL
    );

    console.info(
      "Backend:",
      window.SUPABASE_FUNCTION_URL
    );

  } else {

    console.error(
      "Application configuration is incomplete."
    );

  }

})();
