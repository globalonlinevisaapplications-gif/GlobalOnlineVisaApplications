/* GLOBAL ONLINE VISA APPLICATIONS
   Website enquiry form handler.
   Visa applications and administrator functions
   are handled by their respective HTML pages.
*/

const enquiryForm = document.getElementById("enquiry-form");

if (enquiryForm) {
  enquiryForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const status = document.getElementById("form-status");
    const submitButton = enquiryForm.querySelector(
      'button[type="submit"]'
    );

    if (!status || !submitButton) return;

    status.textContent = "Sending your enquiry...";
    submitButton.disabled = true;

    try {
      const formData = new FormData(enquiryForm);
      const body = new URLSearchParams();

      for (const [key, value] of formData.entries()) {
        body.append(key, String(value));
      }

      const response = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(
          "Your enquiry could not be sent. Please try again later."
        );
      }

      status.textContent =
        "Thank you! Your enquiry has been received.";

      enquiryForm.reset();

    } catch (error) {
      console.error("Enquiry submission error:", error);

      status.textContent =
        error.message || "Something went wrong. Please try again.";

    } finally {
      submitButton.disabled = false;
    }
  });
}
