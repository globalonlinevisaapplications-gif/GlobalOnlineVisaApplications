
/**
 * GLOBAL ONLINE VISA APPLICATIONS
 * Production Configuration - V20
 * Hosting: Netlify
 * Backend: Supabase
 */

(function () {
  "use strict";

  // WEBSITE CONFIGURATION

  window.SITE_NAME = "Global Online Visa Applications";

  window.SITE_URL =
    "https://globalvisaagencies.netlify.app";

  window.SITE_ENVIRONMENT = "production";

  // SUPABASE PROJECT

  window.SUPABASE_URL =
    "https://iqpnlzufcasseycvmvzs.supabase.co";

  // Public publishable key only.
  // Never put a service_role key here.

  window.SUPABASE_ANON_KEY =
    "sb_publishable_W8PD_H5br4lYSFQ1BMMfyA_ywmLOsae";

  // V20 BACKEND - CORRECT DEPLOYED FUNCTION NAME

  window.SUPABASE_FUNCTION_URL =
    window.SUPABASE_URL +
    "/functions/v1/supabase-functions-visa-backend-v20-index-ts";

  // INITIALIZE SUPABASE

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

  // WEBSITE ROUTES

  window.APP_ROUTES = {
    home: window.SITE_URL + "/",
    apply: window.SITE_URL + "/apply.html",
    success: window.SITE_URL + "/thank-you.html",
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

    backendVersion: "visa-backend-v20",

    consultancyServiceFee: 285,

    consultancyServiceFeeCurrency: "USD",

    governmentVisaFeeSeparate: true,

    calculateCombinedFees: false,

    paymentMethod: "later",

    generatePRCAfterAdminApprovalOnly: true,

    maxApplicants: 10,

    maxFileSize: 8 * 1024 * 1024,

    maxFileSizeMB: 8
  };

  // GLOBAL API HELPER

  window.callVisaAPI = async function (action, data = {}) {
    try {
      const sessionResult = window.supabaseClient
        ? await window.supabaseClient.auth.getSession()
        : null;

      const accessToken =
        sessionResult?.data?.session?.access_token ||
        window.SUPABASE_ANON_KEY;

      const response = await fetch(
        window.API_CONFIG.baseURL,
        {
          method: window.API_CONFIG.method,

          headers: {
            ...window.API_CONFIG.headers,
            "Authorization": "Bearer " + accessToken
          },

          body: JSON.stringify({
            action,
            ...data
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          result.message ||
          "API request failed."
        );
      }

      return result;

    } catch (error) {
      console.error("Visa API error:", error);
      throw error;
    }
  };

  // CONFIGURATION READY

  console.info(
    "Global Online Visa Applications initialized.",
    {
      environment: window.SITE_ENVIRONMENT,
      backend: window.APP_CONFIG.backendVersion,
      endpoint: window.SUPABASE_FUNCTION_URL
    }
  );

})();
