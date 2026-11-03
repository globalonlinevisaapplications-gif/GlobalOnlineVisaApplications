
// ======================================
// GLOBAL ONLINE VISA APPLICATIONS
// Main Website JavaScript
// ======================================

document.addEventListener("DOMContentLoaded", function () {

    // Mobile navigation
    const menuButton = document.querySelector(".menu-toggle");
    const navigation = document.querySelector(".nav-links");

    if (menuButton && navigation) {
        menuButton.addEventListener("click", function () {
            navigation.classList.toggle("active");
        });
    }

    // Automatically update copyright year
    const yearElements = document.querySelectorAll(".current-year");

    yearElements.forEach(function (element) {
        element.textContent = new Date().getFullYear();
    });

    // Application form validation
    const applicationForm = document.getElementById("applicationForm");

    if (applicationForm) {
        applicationForm.addEventListener("submit", function (event) {
            event.preventDefault();

            if (!applicationForm.checkValidity()) {
                applicationForm.reportValidity();
                return;
            }

            alert(
                "Thank you! Your information has been entered. " +
                "Please connect the application form to a secure " +
                "submission service before accepting real applications."
            );
        });
    }

    // Contact form validation
    const contactForm = document.getElementById("contactForm");

    if (contactForm) {
        contactForm.addEventListener("submit", function (event) {
            event.preventDefault();

            if (!contactForm.checkValidity()) {
                contactForm.reportValidity();
                return;
            }

            alert(
                "Thank you for contacting Global Online Visa Applications!"
            );
        });
    }

    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            const target = document.querySelector(
                this.getAttribute("href")
            );

            if (target) {
                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });

});
